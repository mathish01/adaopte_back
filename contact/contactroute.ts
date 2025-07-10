import { Router, Request, Response } from "express"
import { authMiddleware, requireAdmin } from "../middleware/authmiddleware"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const router = Router()

// Interfaces pour typer les données reçues dans les requêtes
interface CreateContactRequest {
    userid?: number
    firstname: string
    lastname: string
    email: string
    phone?: string
    subject: string
    message: string
    priority?: string
}

interface UpdateContactRequest {
    status?: string
    priority?: string
}

/* ------------------------- ROUTES CONTACT ----------------------------

🔒 ROUTE PROTÉGÉE UTILISATEUR - Envoyer un message de contact
Responsabilité : Permettre à un utilisateur connecté d'envoyer un message
Validation des données + auto-remplissage des infos utilisateur */

router.post('/contact', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId
        const { subject, message, priority, phone } = req.body as CreateContactRequest

        // Validation des champs obligatoires
        if (!subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Le sujet et le message sont obligatoires'
            })
        }

        // Récupérer les infos de l'utilisateur connecté
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                firstname: true,
                lastname: true,
                email: true,
                phone: true
            }
        })

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            })
        }

        // Validation de la priorité si fournie
        const validPriorities = ['low', 'normal', 'high', 'urgent']
        if (priority && !validPriorities.includes(priority)) {
            return res.status(400).json({
                success: false,
                message: 'Priorité invalide. Priorités autorisées: ' + validPriorities.join(', ')
            })
        }

        // Créer le message de contact
        const contact = await prisma.contact.create({
            data: {
                userid: userId,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                phone: phone || user.phone,
                subject: subject.trim(),
                message: message.trim(),
                priority: priority || 'normal',
                status: 'new'
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
            message: 'Message envoyé avec succès',
            data: contact
        })
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi du message',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🟢 ROUTE PUBLIQUE - Envoyer un message de contact anonyme
Responsabilité : Permettre à n'importe qui d'envoyer un message sans connexion
Utilisée pour les visiteurs non connectés */

router.post('/contact/anonymous', async (req: Request, res: Response) => {
    try {
        const { firstname, lastname, email, phone, subject, message, priority } = req.body as CreateContactRequest

        // Validation des champs obligatoires
        if (!firstname || !lastname || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Les champs prénom, nom, email, sujet et message sont obligatoires'
            })
        }

        // Validation de l'email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Format d\'email invalide'
            })
        }

        // Validation de la priorité si fournie
        const validPriorities = ['low', 'normal', 'high', 'urgent']
        if (priority && !validPriorities.includes(priority)) {
            return res.status(400).json({
                success: false,
                message: 'Priorité invalide. Priorités autorisées: ' + validPriorities.join(', ')
            })
        }

        // Créer le message de contact anonyme
        const contact = await prisma.contact.create({
            data: {
                firstname: firstname.trim(),
                lastname: lastname.trim(),
                email: email.trim(),
                phone: phone?.trim(),
                subject: subject.trim(),
                message: message.trim(),
                priority: priority || 'normal',
                status: 'new'
            }
        })

        res.status(201).json({
            success: true,
            message: 'Message envoyé avec succès',
            data: contact
        })
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message anonyme:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi du message',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE UTILISATEUR - Mes messages de contact
Responsabilité : Récupérer tous les messages de l'utilisateur connecté
Avec l'historique et les statuts de réponse */

router.get('/my-contacts', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId

        const contacts = await prisma.contact.findMany({
            where: { userid: userId },
            orderBy: {
                createdAt: 'desc'
            }
        })

        res.json({
            success: true,
            message: 'Vos messages récupérés avec succès',
            data: contacts
        })
    } catch (error) {
        console.error('Erreur lors de la récupération des messages:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de vos messages',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE UTILISATEUR - Détail d'un message de contact
Responsabilité : Récupérer les détails d'un message spécifique
Uniquement accessible par le propriétaire du message */

router.get('/contact/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId
        const contactId = parseInt(req.params.id)

        if (isNaN(contactId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de message invalide'
            })
        }

        const contact = await prisma.contact.findUnique({
            where: { id: contactId },
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

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            })
        }

        if (contact.userid !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Vous ne pouvez consulter que vos propres messages'
            })
        }

        res.json({
            success: true,
            data: contact
        })

    } catch (error) {
        console.error('Erreur lors de la récupération du message:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du message',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Tous les messages de contact
Responsabilité : Lister tous les messages pour l'administration
Avec les informations des expéditeurs et filtres */

router.get('/admin/contacts', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { status, priority } = req.query

        let contacts
        if (status) {
            // Filtrer par statut
            contacts = await prisma.contact.findMany({
                where: { status: status as string },
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
        } else if (priority) {
            // Filtrer par priorité
            contacts = await prisma.contact.findMany({
                where: { priority: priority as string },
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
        } else {
            // Tous les messages
            contacts = await prisma.contact.findMany({
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
                orderBy: [
                    { status: 'asc' }, // new en premier
                    { priority: 'desc' }, // urgent en premier
                    { createdAt: 'desc' }
                ]
            })
        }

        res.json({
            success: true,
            message: 'Messages récupérés avec succès',
            data: contacts,
            filters: { status, priority }
        })

    } catch (error) {
        console.error('Erreur lors de la récupération de tous les messages:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des messages',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Mettre à jour un message
Responsabilité : Permettre aux administrateurs de modifier le statut/priorité
Utilisée pour marquer comme lu/répondu */

router.put('/admin/contacts/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const contactId = parseInt(req.params.id)
        const { status, priority } = req.body as UpdateContactRequest

        if (isNaN(contactId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de message invalide'
            })
        }

        // Vérifier que le message existe
        const existingContact = await prisma.contact.findUnique({
            where: { id: contactId }
        })

        if (!existingContact) {
            return res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            })
        }

        // Validation du statut
        const validStatuses = ['new', 'read', 'replied', 'closed']
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Statut invalide. Statuts autorisés: ' + validStatuses.join(', ')
            })
        }

        // Validation de la priorité
        const validPriorities = ['low', 'normal', 'high', 'urgent']
        if (priority && !validPriorities.includes(priority)) {
            return res.status(400).json({
                success: false,
                message: 'Priorité invalide. Priorités autorisées: ' + validPriorities.join(', ')
            })
        }

        // Préparer les données de mise à jour
        const updateData: any = {}
        if (status) updateData.status = status
        if (priority) updateData.priority = priority
        if (status === 'replied') updateData.repliedAt = new Date()

        // Mettre à jour le message
        const updatedContact = await prisma.contact.update({
            where: { id: contactId },
            data: updateData,
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
            message: 'Message mis à jour avec succès',
            data: updatedContact
        })

    } catch (error) {
        console.error('Erreur lors de la mise à jour du message:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du message',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Marquer comme lu
Responsabilité : Raccourci pour marquer un message comme lu */

router.patch('/admin/contacts/:id/read', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const contactId = parseInt(req.params.id)

        if (isNaN(contactId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de message invalide'
            })
        }

        const contact = await prisma.contact.update({
            where: { id: contactId },
            data: { status: 'read' },
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
            message: 'Message marqué comme lu',
            data: contact
        })

    } catch (error) {
        console.error('Erreur lors du marquage comme lu:', error)

        if (error instanceof Error && error.message.includes('Record to update not found')) {
            return res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            })
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors du marquage comme lu',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Marquer comme répondu
Responsabilité : Raccourci pour marquer un message comme répondu */

router.patch('/admin/contacts/:id/reply', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const contactId = parseInt(req.params.id)

        if (isNaN(contactId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de message invalide'
            })
        }

        const contact = await prisma.contact.update({
            where: { id: contactId },
            data: { 
                status: 'replied',
                repliedAt: new Date()
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
            message: 'Message marqué comme répondu',
            data: contact
        })

    } catch (error) {
        console.error('Erreur lors du marquage comme répondu:', error)

        if (error instanceof Error && error.message.includes('Record to update not found')) {
            return res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            })
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors du marquage comme répondu',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Statistiques des messages
Responsabilité : Fournir un dashboard avec les statistiques des messages
Utilisée pour les tableaux de bord administrateur */

router.get('/admin/contacts/stats', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const [totalCount, newMessages, readMessages, repliedMessages, closedMessages] = await Promise.all([
            prisma.contact.count(),
            prisma.contact.count({
                where: { status: 'new' }
            }),
            prisma.contact.count({
                where: { status: 'read' }
            }),
            prisma.contact.count({
                where: { status: 'replied' }
            }),
            prisma.contact.count({
                where: { status: 'closed' }
            })
        ])

        // Messages par priorité
        const [lowPriority, normalPriority, highPriority, urgentPriority] = await Promise.all([
            prisma.contact.count({ where: { priority: 'low' } }),
            prisma.contact.count({ where: { priority: 'normal' } }),
            prisma.contact.count({ where: { priority: 'high' } }),
            prisma.contact.count({ where: { priority: 'urgent' } })
        ])

        const stats = {
            totalMessages: totalCount,
            statusStats: {
                new: newMessages,
                read: readMessages,
                replied: repliedMessages,
                closed: closedMessages
            },
            priorityStats: {
                low: lowPriority,
                normal: normalPriority,
                high: highPriority,
                urgent: urgentPriority
            },
            responseRate: totalCount > 0 ? Math.round((repliedMessages / totalCount) * 100) : 0
        }

        res.json({
            success: true,
            message: 'Statistiques des messages récupérées avec succès',
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

/* 🔒 ROUTE PROTÉGÉE ADMIN - Supprimer un message
Responsabilité : Permettre aux administrateurs de supprimer un message
Avec vérifications de sécurité */

router.delete('/admin/contacts/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const contactId = parseInt(req.params.id)

        if (isNaN(contactId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de message invalide'
            })
        }

        // Vérifier que le message existe
        const contact = await prisma.contact.findUnique({
            where: { id: contactId }
        })

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Message non trouvé'
            })
        }

        // Supprimer le message
        await prisma.contact.delete({
            where: { id: contactId }
        })

        res.json({
            success: true,
            message: 'Message supprimé avec succès'
        })

    } catch (error) {
        console.error('Erreur lors de la suppression du message:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du message',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

export default router