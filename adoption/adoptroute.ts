import { Router, Request, Response } from "express"
import { AnimalService } from "../services/animalservice" 
import { authMiddleware, requireAdmin } from "../middleware/authmiddleware"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const router = Router()


// Interfaces pour typer les données reçues dans les requêtes 
interface CreateAnimalRequest {
    type: string 
    name: string 
    city: string
    age: number
    breed: string
    description?: string
}

interface UpdateAnimalRequest {
    type?: string
    name?: string
    city?: string
    age?: number
    breed?: string
    description?: string
    status?: string
}

interface SearchAnimalRequest {
    type?: string
    city?: string
    breed?: string
    minAge?: string
    maxAge?: string
    status?: string
}

interface CreateAdoptionRequest {
    animalId: number
    firstname: string
    lastname: string
    phone: string
}

/* 🔒 ROUTE PROTÉGÉE UTILISATEUR - Créer une demande d'adoption
Responsabilité : Permettre à un utilisateur connecté de faire une demande d'adoption
Validation des données + vérification que l'animal est disponible*/

router.post('/adoptions', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId 
        const { animalId, firstname, lastname, phone } = req.body as CreateAdoptionRequest 

        // Validation des champs obligatoires 
        if (!animalId || !firstname || !lastname || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs sont requis (animalId, firstname, lastname, phone)'
            })
        }

        // Vérifier que l'animal existe et est dispo 
        const animal = await prisma.animal.findUnique({
            where: { id: animalId }
        })

        if (!animal) {
            return res.status(404).json({
                success: false, 
                message: 'Animal non trouvé'
            })
        }

        if (animal.status !== 'available') {
            return res.status(400).json({
                success: false,
                message: 'Cet animal n\'est plus disponible à l\'adoption'
            })
        }

        // Vérifier que l'utilisateur n'a pas déjà fait une demande pour cet animal 
        const existingAdoption = await prisma.adopt.findFirst({
            where: {
                userid: userId,
                animalid: animalId, 
                status: {
                    in: ['pending', 'approved']
                }
            }
        })

        if (existingAdoption) {
            return res.status(409).json({
                succes: false, 
                message: 'Vous avez déjà une demande d\'adoption en cours pour cet animal'
            })
        }

        //Créer la demande d'adoption 
        const adoption = await prisma.adopt.create({
            data: {
                userid: userId,
                animalid: animalId,
                firstname: firstname.trim(),
                lastname: lastname.trim(),
                phone: phone.trim(),
                status: 'pending'
            },
            include: {
                animal: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        breed: true,
                        age: true,
                        city: true 

                    }
                }
            }
        })

        res.status(201).json({
            success: true, 
            message: 'Demande d\'adoption créée avec succcès', 
            data: adoption
        })
    } catch (error) {
        console.error('Erreur lors de la création de la demande d\'adoption:', error)

        res.status(500).json({
            success: true,
            message: 'Erreur lors de la création de la demande d\'adoption', 
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})


/* 🔒 ROUTE PROTÉGÉE UTILISATEUR - Mes demandes d'adoption
Responsabilité : Récupérer toutes les demandes d'adoption de l'utilisateur connecté
Avec les détails des animaux concernés et le statut des demandes*/

router.get('/my-adoption', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId

        const adoptions = await prisma.adopt.findMany({
            where: {userid: userId },
            include: {
                animal: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        breed: true,
                        age: true,
                        city: true,
                        description: true,
                        status: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        res.json({
            success: true,
            message: 'Vos demandes d\'adoption récupérées avec succès',
            data: adoptions
        })
    } catch (error) {
        console.error('Erreur lors de la récupération des adoptions:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de vos demandes d\'adoption',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE UTILISATEUR - Annuler une demande d'adoption
Responsabilité : Permettre à un utilisateur d'annuler sa propre demande d'adoption
Uniquement si elle est encore en statut "pending"*/

router.delete('/adoption/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId
        const adoptionId = parseInt(req.params.id)

        if (isNaN(adoptionId)) {
            return res.status(400).json({
                success: false, 
                message: 'ID de demande d\'adoption invalide' 
            })
        }

        // Vérifier que la demande existe et appartient à l'utilisateur 
        const adoption = await prisma.adopt.findUnique({
            where: { id: adoptionId }
        })

        if (!adoption) {
            return res.status(404).json({
                success: false,
                message: 'Demande d\'adoption non trouvée'
            })
        }

        if (adoption.userid !== userId) {
            return res.status(403).json({
                success: false, 
                message: 'Vous ne pouvez annulez que vos propres d\'adoption'
            })
        }
        if (adoption.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Vous ne pouvez annuler que les demandes en attente'
            })
        }

        // Supprimer la demande d'adoption
        await prisma.adopt.delete({
            where: { id: adoptionId }
        })

        res.json({
            success: true, 
            message: 'Demande d\'adoption annulée avec succès'
        })
    } catch (error) {
        console.error('Erreur lors de l\'annulation de la demande d\'adoption:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'annulation de la demande d\'adoption', 
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined 
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE UTILISATEUR - Détail d'une demande d'adoption
Responsabilité : Récupérer les détails d'une demande d'adoption spécifique
Uniquement accessible par le propriétaire de la demande*/

router.get('/adoptions/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId 
        const adoptionId = parseInt(req.params.id) 

        if (isNaN(adoptionId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de demande d\'adoption invalide'
            })
        }

          const adoption = await prisma.adopt.findUnique({
            where: { id: adoptionId },
            include: {
                animal: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        breed: true,
                        age: true,
                        city: true,
                        description: true,
                        status: true
                    }
                }
            }
        })

        if (!adoption) {
            return res.status(404).json({
                success: false,
                message: 'Demande d\'adoption non trouvée'
            })
        }

        if (adoption.userid !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Vous ne pouvez consulter que vos propres demandes d\'adoption'
            })
        }

        res.json({
            success: true,
            data: adoption
        })

    } catch (error) {
        console.error('Erreur lors de la récupération de la demande d\'adoption:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de la demande d\'adoption',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

 /* ------------------------ ROUTES PUBLIQUES (Vue utilisateur)----------------------------
Responsabilité : Récupérer et retourner la liste des animaux disponibles à l'adoption
Utilisée pour alimenter la page d'adoption avec les vignettes d'animaux
*/
router.get('/animals', async (req: Request, res: Response) => {
    try {
        const animals = await AnimalService.getAvailableAnimals()

        res.json({
            success: true,
            message: 'Liste des animaux disponibles récupérée avec succès',
            data: animals
        })

    } catch (error) {
        console.error('Erreur lors de la récupération des animaux:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des animaux',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🟢 ROUTE PUBLIQUE - Rechercher des animaux avec filtres
Responsabilité : Permettre la recherche d'animaux selon différents critères
Gère les paramètres de recherche envoyés via query string
*/
router.get('/animals/search', async (req: Request, res: Response) => {
    try {
        const { type, city, breed, minAge, maxAge, status } = req.query as SearchAnimalRequest

        // Validation et conversion des paramètres
        const filters: any = {}

        if (type) filters.type = type
        if (city) filters.city = city
        if (breed) filters.breed = breed
        if (status) filters.status = status

        // Conversion des âges en nombres si fournis
        if (minAge) {
            const minAgeNum = parseInt(minAge)
            if (isNaN(minAgeNum) || minAgeNum < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'L\'âge minimum doit être un nombre positif'
                })
            }
            filters.minAge = minAgeNum
        }

        if (maxAge) {
            const maxAgeNum = parseInt(maxAge)
            if (isNaN(maxAgeNum) || maxAgeNum < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'L\'âge maximum doit être un nombre positif'
                })
            }
            filters.maxAge = maxAgeNum
        }

        // Vérifier la cohérence des âges
        if (filters.minAge && filters.maxAge && filters.minAge > filters.maxAge) {
            return res.status(400).json({
                success: false,
                message: 'L\'âge minimum ne peut pas être supérieur à l\'âge maximum'
            })
        }

        const animals = await AnimalService.searchAnimals(filters)

        res.json({
            success: true,
            message: `${animals.length} animal(s) trouvé(s)`,
            data: animals,
            filters: filters // Retourner les filtres appliqués pour info
        })

    } catch (error) {
        console.error('Erreur lors de la recherche d\'animaux:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche d\'animaux',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🟢 ROUTE PUBLIQUE - Récupérer un animal par son ID
Responsabilité : Afficher les détails complets d'un animal spécifique
Utilisée pour la page de détail d'un animal avant adoption
*/
router.get('/animals/:id', async (req: Request, res: Response) => {
    try {
        const animalId = parseInt(req.params.id)

        if (isNaN(animalId)) {
            return res.status(400).json({
                success: false,
                message: 'ID d\'animal invalide'
            })
        }

        const animal = await AnimalService.getAnimalById(animalId)

        res.json({
            success: true,
            data: animal
        })

    } catch (error) {
        console.error('Erreur lors de la récupération de l\'animal:', error)

        if (error instanceof Error && error.message === 'Animal non trouvé') {
            return res.status(404).json({
                success: false,
                message: error.message
            })
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'animal',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Créer un nouvel animal
Responsabilité : Permettre aux administrateurs d'ajouter des animaux dans le système
Validation des données d'entrée + délégation au service
*/
router.post('/animals', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { type, name, city, age, breed, description } = req.body as CreateAnimalRequest

        // Validation des champs obligatoires
        if (!type || !name || !city || !breed) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs obligatoires doivent être renseignés (type, name, city, breed)'
            })
        }

        // Validation de l'âge
        if (age === undefined || age === null) {
            return res.status(400).json({
                success: false,
                message: 'L\'âge de l\'animal est obligatoire'
            })
        }

        // Validation avec les méthodes centralisées du service
        const nameValidation = AnimalService.isValidAnimalName(name)
        if (!nameValidation.valid) {
            return res.status(400).json({
                success: false,
                message: nameValidation.message
            })
        }

        const ageValidation = AnimalService.isValidAge(age)
        if (!ageValidation.valid) {
            return res.status(400).json({
                success: false,
                message: ageValidation.message
            })
        }

        // Délégation de toute la logique métier au service
        const animal = await AnimalService.createAnimal({
            type: type.trim(),
            name: name.trim(),
            city: city.trim(),
            age,
            breed: breed.trim(),
            description: description?.trim()
        })

        res.status(201).json({
            success: true,
            message: 'Animal créé avec succès',
            data: animal
        })

    } catch (error) {
        console.error('Erreur lors de la création de l\'animal:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de l\'animal',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Modifier un animal
Responsabilité : Permettre aux administrateurs de mettre à jour les informations d'un animal
Validation des données + gestion des erreurs métier
*/
router.put('/animals/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const animalId = parseInt(req.params.id)
        const { type, name, city, age, breed, description, status } = req.body as UpdateAnimalRequest

        if (isNaN(animalId)) {
            return res.status(400).json({
                success: false,
                message: 'ID d\'animal invalide'
            })
        }

        // Vérifier qu'au moins un champ est fourni pour la mise à jour
        if (!type && !name && !city && age === undefined && !breed && !description && !status) {
            return res.status(400).json({
                success: false,
                message: 'Vous devez fournir au moins un champ à mettre à jour'
            })
        }

        // Validation des champs modifiés
        if (name && !AnimalService.isValidAnimalName(name).valid) {
            return res.status(400).json({
                success: false,
                message: AnimalService.isValidAnimalName(name).message
            })
        }

        if (age !== undefined && !AnimalService.isValidAge(age).valid) {
            return res.status(400).json({
                success: false,
                message: AnimalService.isValidAge(age).message
            })
        }

        // Délégation au service
        const updatedAnimal = await AnimalService.updateAnimal(animalId, {
            type,
            name,
            city,
            age,
            breed,
            description,
            status
        })

        res.json({
            success: true,
            message: 'Animal mis à jour avec succès',
            data: updatedAnimal
        })

    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'animal:', error)

        if (error instanceof Error) {
            if (error.message === 'Animal non trouvé') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                })
            }
            if (error.message.includes('Statut invalide')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                })
            }
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de l\'animal',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Supprimer un animal
Responsabilité : Permettre aux administrateurs de supprimer un animal du système
Avec vérifications de sécurité (pas d'adoptions en cours)
*/
router.delete('/animals/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const animalId = parseInt(req.params.id)

        if (isNaN(animalId)) {
            return res.status(400).json({
                success: false,
                message: 'ID d\'animal invalide'
            })
        }

        const result = await AnimalService.deleteAnimal(animalId)

        res.json({
            success: true,
            message: result.message
        })

    } catch (error) {
        console.error('Erreur lors de la suppression de l\'animal:', error)

        if (error instanceof Error) {
            if (error.message === 'Animal non trouvé') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                })
            }
            if (error.message.includes('demandes d\'adoption en cours')) {
                return res.status(409).json({
                    success: false,
                    message: error.message
                })
            }
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de l\'animal',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Marquer comme adopté
Responsabilité : Changer le statut d'un animal vers "adopté"
Utilisée quand une adoption est finalisée
*/
router.patch('/animals/:id/adopt', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const animalId = parseInt(req.params.id)

        if (isNaN(animalId)) {
            return res.status(400).json({
                success: false,
                message: 'ID d\'animal invalide'
            })
        }

        const animal = await AnimalService.markAsAdopted(animalId)

        res.json({
            success: true,
            message: 'Animal marqué comme adopté avec succès',
            data: animal
        })

    } catch (error) {
        console.error('Erreur lors du marquage comme adopté:', error)

        if (error instanceof Error) {
            if (error.message === 'Animal non trouvé') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                })
            }
            if (error.message.includes('déjà adopté')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                })
            }
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors du marquage comme adopté',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Remettre comme disponible
Responsabilité : Changer le statut d'un animal vers "available"
Utilisée si une adoption n'aboutit pas
*/
router.patch('/animals/:id/available', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const animalId = parseInt(req.params.id)

        if (isNaN(animalId)) {
            return res.status(400).json({
                success: false,
                message: 'ID d\'animal invalide'
            })
        }

        const animal = await AnimalService.markAsAvailable(animalId)

        res.json({
            success: true,
            message: 'Animal remis comme disponible avec succès',
            data: animal
        })

    } catch (error) {
        console.error('Erreur lors de la remise en disponibilité:', error)

        if (error instanceof Error && error.message === 'Animal non trouvé') {
            return res.status(404).json({
                success: false,
                message: error.message
            })
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la remise en disponibilité',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Statistiques des animaux
Responsabilité : Fournir un dashboard avec les statistiques globales
Utilisée pour les tableaux de bord administrateur
*/
router.get('/admin/stats', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const stats = await AnimalService.getAnimalStats()

        res.json({
            success: true,
            message: 'Statistiques récupérées avec succès',
            data: stats
        })

    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Tous les animaux (y compris adoptés)
Responsabilité : Lister tous les animaux pour l'administration
Avec les informations d'adoption si applicable
*/
router.get('/admin/animals', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const animals = await AnimalService.getAllAnimals()

        res.json({
            success: true,
            message: 'Liste complète des animaux récupérée avec succès',
            data: animals
        })

    } catch (error) {
        console.error('Erreur lors de la récupération de tous les animaux:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des animaux',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Récupérer toutes les demandes d'adoption
Responsabilité : Permettre aux administrateurs de voir toutes les demandes d'adoption
Avec filtrage par statut et informations complètes utilisateur + animal*/

router.get('/admin/adoptions', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { status } = req.query

        // Construire les conditions de filtrage
        const whereConditions: any = {}
        
        if (status && status !== 'all') {
            whereConditions.status = status
        }

        const adoptions = await prisma.adopt.findMany({
            where: whereConditions,
            include: {
                users: {
                    select: {
                        id: true,
                        firstname: true,
                        lastname: true,
                        email: true,
                        phone: true,
                        createdAt: true
                    }
                },
                animal: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        breed: true,
                        age: true,
                        city: true,
                        description: true,
                        status: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        res.json({
            success: true,
            message: 'Demandes d\'adoption récupérées avec succès',
            data: adoptions
        })

    } catch (error) {
        console.error('Erreur lors de la récupération des adoptions admin:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des demandes d\'adoption',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Approuver/Rejeter une demande d'adoption
Responsabilité : Permettre aux administrateurs de modérer les demandes d'adoption
Change le statut de la demande ET de l'animal si approuvé*/

router.put('/admin/adoptions/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const adoptionId = parseInt(req.params.id)
        const { status, adminComment } = req.body

        if (isNaN(adoptionId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de demande d\'adoption invalide'
            })
        }

        // Vérifier les statuts valides
        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Statut invalide. Statuts autorisés: pending, approved, rejected'
            })
        }

        // Vérifier que la demande existe
        const existingAdoption = await prisma.adopt.findUnique({
            where: { id: adoptionId },
            include: {
                animal: true,
                users: {
                    select: {
                        firstname: true,
                        lastname: true,
                        email: true
                    }
                }
            }
        })

        if (!existingAdoption) {
            return res.status(404).json({
                success: false,
                message: 'Demande d\'adoption non trouvée'
            })
        }

        // Transaction pour mettre à jour à la fois l'adoption et l'animal
        const result = await prisma.$transaction(async (tx) => {
            // Mettre à jour la demande d'adoption
            const updatedAdoption = await tx.adopt.update({
                where: { id: adoptionId },
                data: {
                    status: status,
                    user: adminComment || null // Stocker le commentaire admin dans le champ user temporairement
                },
                include: {
                    users: {
                        select: {
                            id: true,
                            firstname: true,
                            lastname: true,
                            email: true
                        }
                    },
                    animal: true
                }
            })

            // Si approuvé, marquer l'animal comme adopté et rejeter les autres demandes pour cet animal
            if (status === 'approved') {
                // Marquer l'animal comme adopté
                await tx.animal.update({
                    where: { id: existingAdoption.animalid },
                    data: { status: 'adopted' }
                })

                // Rejeter automatiquement toutes les autres demandes pending pour cet animal
                await tx.adopt.updateMany({
                    where: {
                        animalid: existingAdoption.animalid,
                        id: { not: adoptionId },
                        status: 'pending'
                    },
                    data: { 
                        status: 'rejected',
                        user: 'Rejeté automatiquement - animal adopté par un autre utilisateur'
                    }
                })
            }

            // Si rejeté et que l'animal était en pending, le remettre disponible
            if (status === 'rejected' && existingAdoption.animal.status === 'pending') {
                // Vérifier s'il n'y a plus d'autres demandes pending pour cet animal
                const otherPendingAdoptions = await tx.adopt.count({
                    where: {
                        animalid: existingAdoption.animalid,
                        id: { not: adoptionId },
                        status: 'pending'
                    }
                })

                // Si plus de demandes pending, remettre l'animal disponible
                if (otherPendingAdoptions === 0) {
                    await tx.animal.update({
                        where: { id: existingAdoption.animalid },
                        data: { status: 'available' }
                    })
                }
            }

            return updatedAdoption
        })

        res.json({
            success: true,
            message: `Demande d'adoption ${status === 'approved' ? 'approuvée' : status === 'rejected' ? 'rejetée' : 'mise à jour'} avec succès`,
            data: result
        })

    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'adoption:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour de la demande d\'adoption',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Statistiques des adoptions
Responsabilité : Fournir les statistiques pour le dashboard admin
Compte par statut et données récentes*/

router.get('/admin/adoptions/stats', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        // Compter les adoptions par statut
        const totalAdoptions = await prisma.adopt.count()
        
        const pendingAdoptions = await prisma.adopt.count({
            where: { status: 'pending' }
        })
        
        const approvedAdoptions = await prisma.adopt.count({
            where: { status: 'approved' }
        })
        
        const rejectedAdoptions = await prisma.adopt.count({
            where: { status: 'rejected' }
        })

        // Adoptions ce mois
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const adoptionsThisMonth = await prisma.adopt.count({
            where: {
                createdAt: {
                    gte: startOfMonth
                }
            }
        })

        // Adoptions récentes avec détails
        const recentAdoptions = await prisma.adopt.findMany({
            take: 10,
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                users: {
                    select: {
                        firstname: true,
                        lastname: true,
                        email: true
                    }
                },
                animal: {
                    select: {
                        name: true,
                        type: true,
                        breed: true
                    }
                }
            }
        })

        res.json({
            success: true,
            message: 'Statistiques des adoptions récupérées avec succès',
            data: {
                total: totalAdoptions,
                pending: pendingAdoptions,
                approved: approvedAdoptions,
                rejected: rejectedAdoptions,
                thisMonth: adoptionsThisMonth,
                recent: recentAdoptions
            }
        })

    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques d\'adoption:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Supprimer une demande d'adoption
Responsabilité : Permettre aux administrateurs de supprimer complètement une demande
Utilisé pour nettoyer les anciennes demandes ou en cas d'erreur*/

router.delete('/admin/adoptions/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const adoptionId = parseInt(req.params.id)

        if (isNaN(adoptionId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de demande d\'adoption invalide'
            })
        }

        // Vérifier que la demande existe
        const existingAdoption = await prisma.adopt.findUnique({
            where: { id: adoptionId }
        })

        if (!existingAdoption) {
            return res.status(404).json({
                success: false,
                message: 'Demande d\'adoption non trouvée'
            })
        }

        // Supprimer la demande
        await prisma.adopt.delete({
            where: { id: adoptionId }
        })

        res.json({
            success: true,
            message: 'Demande d\'adoption supprimée avec succès'
        })

    } catch (error) {
        console.error('Erreur lors de la suppression de l\'adoption:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de la demande d\'adoption',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

export default router