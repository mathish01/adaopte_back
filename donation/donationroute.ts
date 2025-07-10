import { Router, Request, Response } from "express"
import { authMiddleware, requireAdmin } from "../middleware/authmiddleware"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const router = Router() 


// Interfaces pour typer les données reçues dans les requêtes
interface CreateDonationRequest {
    userid?: number
    firstname: string
    lastname: string
    email: string
    phone?: string
    amount: number
    message?: string
    isAnonymous?: boolean
    paymentMethod?: string
}

interface UpdateDonationRequest {
    status?: string
    paymentId?: string
    paymentMethod?: string
}

/* --------------------- ROUTES DONATION -------------------------------

🔒 ROUTE PROTÉGÉE UTILISATEUR - Créer un don
Responsabilité : Permettre à un utilisateur connecté de faire un don
Validation des données + vérification du montant */

router.post('/donations', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId
        const { firstname, lastname, email, phone, amount, message, isAnonymous, paymentMethod } = req.body as CreateDonationRequest

        // Validation des champs obligatoires
        if (!firstname || !lastname || !email || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Les champs prénom, nom, email et montant sont obligatoires'
            })
        }

        // Validation du montant
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Le montant doit être un nombre positif'
            })
        }

        // Créer le don
        const donation = await prisma.donation.create({
            data: {
                userid: userId,
                firstname: firstname.trim(),
                lastname: lastname.trim(),
                email: email.trim(),
                phone: phone?.trim(),
                amount: parseFloat(amount.toString()),
                message: message?.trim(),
                isAnonymous: isAnonymous || false,
                paymentMethod,
                status: 'pending'
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstname: true,
                        lastname: true,
                        email: true
                    }
                }
            }
        })

        res.status(201).json({
            success: true,
            message: 'Don créé avec succès',
            data: donation
        })
    } catch (error) {
        console.error('Erreur lors de la création du don:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du don',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🟢 ROUTE PUBLIQUE - Créer un don anonyme
Responsabilité : Permettre à n'importe qui de faire un don sans connexion
Utilisée pour les visiteurs non connectés */

router.post('/donations/anonymous', async (req: Request, res: Response) => {
    try {
        const { firstname, lastname, email, phone, amount, message, paymentMethod } = req.body as CreateDonationRequest

        // Validation des champs obligatoires
        if (!firstname || !lastname || !email || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Les champs prénom, nom, email et montant sont obligatoires'
            })
        }

        // Validation du montant
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Le montant doit être un nombre positif'
            })
        }

        // Créer le don anonyme
        const donation = await prisma.donation.create({
            data: {
                firstname: firstname.trim(),
                lastname: lastname.trim(),
                email: email.trim(),
                phone: phone?.trim(),
                amount: parseFloat(amount.toString()),
                message: message?.trim(),
                isAnonymous: true,
                paymentMethod,
                status: 'pending'
            }
        })

        res.status(201).json({
            success: true,
            message: 'Don anonyme créé avec succès',
            data: donation
        })
    } catch (error) {
        console.error('Erreur lors de la création du don anonyme:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du don',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE UTILISATEUR - Mes dons
Responsabilité : Récupérer tous les dons de l'utilisateur connecté
Avec l'historique et les statuts */

router.get('/my-donations', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId

        const donations = await prisma.donation.findMany({
            where: { userid: userId },
            orderBy: {
                createdAt: 'desc'
            }
        })

        res.json({
            success: true,
            message: 'Vos dons récupérés avec succès',
            data: donations
        })
    } catch (error) {
        console.error('Erreur lors de la récupération des dons:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de vos dons',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE UTILISATEUR - Détail d'un don
Responsabilité : Récupérer les détails d'un don spécifique
Uniquement accessible par le propriétaire du don */

router.get('/donations/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId
        const donationId = parseInt(req.params.id)

        if (isNaN(donationId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de don invalide'
            })
        }

        const donation = await prisma.donation.findUnique({
            where: { id: donationId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstname: true,
                        lastname: true,
                        email: true
                    }
                }
            }
        })

        if (!donation) {
            return res.status(404).json({
                success: false,
                message: 'Don non trouvé'
            })
        }

        if (donation.userid !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Vous ne pouvez consulter que vos propres dons'
            })
        }

        res.json({
            success: true,
            data: donation
        })

    } catch (error) {
        console.error('Erreur lors de la récupération du don:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du don',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Tous les dons
Responsabilité : Lister tous les dons pour l'administration
Avec les informations des donateurs */

router.get('/admin/donations', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const donations = await prisma.donation.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        firstname: true,
                        lastname: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        res.json({
            success: true,
            message: 'Liste complète des dons récupérée avec succès',
            data: donations
        })

    } catch (error) {
        console.error('Erreur lors de la récupération de tous les dons:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des dons',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Mettre à jour le statut d'un don
Responsabilité : Permettre aux administrateurs de modifier le statut d'un don
Utilisée pour marquer comme payé/échoué */

router.put('/admin/donations/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const donationId = parseInt(req.params.id)
        const { status, paymentId, paymentMethod } = req.body as UpdateDonationRequest

        if (isNaN(donationId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de don invalide'
            })
        }

        // Vérifier que le don existe
        const existingDonation = await prisma.donation.findUnique({
            where: { id: donationId }
        })

        if (!existingDonation) {
            return res.status(404).json({
                success: false,
                message: 'Don non trouvé'
            })
        }

        // Validation du statut
        const validStatuses = ['pending', 'completed', 'failed', 'refunded']
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Statut invalide. Statuts autorisés: ' + validStatuses.join(', ')
            })
        }

        // Mettre à jour le don
        const updatedDonation = await prisma.donation.update({
            where: { id: donationId },
            data: {
                status,
                paymentId,
                paymentMethod
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstname: true,
                        lastname: true,
                        email: true
                    }
                }
            }
        })

        res.json({
            success: true,
            message: 'Don mis à jour avec succès',
            data: updatedDonation
        })

    } catch (error) {
        console.error('Erreur lors de la mise à jour du don:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du don',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Statistiques des dons
Responsabilité : Fournir un dashboard avec les statistiques des dons
Utilisée pour les tableaux de bord administrateur */

router.get('/admin/donations/stats', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const [totalAmount, totalCount, completedDonations, pendingDonations] = await Promise.all([
            prisma.donation.aggregate({
                where: { status: 'completed' },
                _sum: { amount: true }
            }),
            prisma.donation.count(),
            prisma.donation.count({
                where: { status: 'completed' }
            }),
            prisma.donation.count({
                where: { status: 'pending' }
            })
        ])

        const stats = {
            totalAmount: totalAmount._sum.amount || 0,
            totalDonations: totalCount,
            completedDonations,
            pendingDonations,
            failedDonations: totalCount - completedDonations - pendingDonations
        }

        res.json({
            success: true,
            message: 'Statistiques des dons récupérées avec succès',
            data: stats
        })

    } catch (error) {
        console.error('Erreur lors du calcul des statistiques:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors du calcul des statistiques',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Supprimer un don
Responsabilité : Permettre aux administrateurs de supprimer un don
Avec vérifications de sécurité */

router.delete('/admin/donations/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const donationId = parseInt(req.params.id)

        if (isNaN(donationId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de don invalide'
            })
        }

        // Vérifier que le don existe
        const donation = await prisma.donation.findUnique({
            where: { id: donationId }
        })

        if (!donation) {
            return res.status(404).json({
                success: false,
                message: 'Don non trouvé'
            })
        }

        // Vérifier qu'on ne supprime pas un don complété (sécurité)
        if (donation.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Impossible de supprimer un don déjà complété'
            })
        }

        // Supprimer le don
        await prisma.donation.delete({
            where: { id: donationId }
        })

        res.json({
            success: true,
            message: 'Don supprimé avec succès'
        })

    } catch (error) {
        console.error('Erreur lors de la suppression du don:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du don',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})


export default router 