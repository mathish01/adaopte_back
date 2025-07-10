import { Router, Request, Response } from "express"
import { VolunteerService } from "../services/volunteerservice"
import { authMiddleware, requireAdmin } from "../middleware/authmiddleware"

const router = Router()

// Interfaces pour typer les données reçues dans les requêtes 
interface CreateVolunteerRequest {
    firstname: string
    lastname: string 
    email: string 
    phone: string 
    city: string 
    age: number
    motivation?: string 
    experience?: string 
    availability?: string 
    skills?: string 
}

interface UpdateVolunteerRequest {
    firstname: string
    lastname: string 
    email: string 
    phone: string 
    city: string 
    age: number
    motivation?: string 
    experience?: string 
    availability?: string 
    skills?: string 
    status?: string 
}

interface SearchVolunteerRequest {
    city?: string 
    status?: string 
    minAge?: string 
    maxAge?:string 
    skills: string 
}

/* ----------------------- ROUTES PUBLIQUES -----------------
Responsabilité : Permettre à toute personne de postuler comme bénévole
Validation des données d'entrée + création de la candidature */

router.post('/apply', async (req: Request, res: Response) => {
    try {
        const { firstname, lastname, email, phone, city, age, motivation, experience, availability, skills } = req.body as CreateVolunteerRequest 

        // Validation des champs obligatoires 
        if (!firstname || !lastname || !email || !phone ||!city) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs obligatoires doivent être renseignées (firstname, lastname, email, phone, city:'
            })
        }

        // Validation de l'âge 
        if (age === undefined ||age === null) {
            return res.status(400).json({
                success: false,
                message: 'L\'âge est obligatoire'
            })
        }

        // Validation avec les méthodes centralisées du service 
        if (!VolunteerService.isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Format d\'email invalide'
            })
        }

        if (!VolunteerService.isValidPhone(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Format de téléphone invalide (format français attentu)'
            })
        }

        const firstnameValidation = VolunteerService.isValidName(firstname)
        if (!firstnameValidation.valid) {
            return res.status(400).json({
                success: false,
                message: `Prénom invalide: ${firstnameValidation.message}`
            })
        }

        const lastnameValidation = VolunteerService.isValidName(lastname)
        if (!lastnameValidation.valid) {
            return res.status(400).json({
                success: false, 
                message: `Nom invalide: ${lastnameValidation.message}`
            })
        }

        const ageValidation = VolunteerService.isValidAge(age)
        if (!ageValidation.valid) {
            return res.status(400).json({
                success: false,
                message: ageValidation.message
            })
        }

        // Délégation de toute la logique métier au service 
        const volunteer = await VolunteerService.createVolunteerApplication({
            firstname: firstname.trim(),
            lastname: lastname.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            city: city.trim(),
            age,
            motivation: motivation?.trim(),
            experience: experience?.trim(),
            availability: availability?.trim(),
            skills: skills?.trim()
        }) 

        res.status(201).json({
            success: true, 
            message: 'Votre candidature de bénévolat a été soumis avec succès ! Nous vous recontacterons prochainement.',
            data: {
                id: volunteer.id,
                firstname: volunteer.firstname,
                lastname: volunteer.lastname,
                email: volunteer.email,
                status: volunteer.status,
                createdAt: volunteer.createdAt
            }
        })
    } catch (error) {
        console.error('Erreur lors de la soumission de la candidature', error)

        // Gestion des erreurs métier retournées par le service 
        if (error instanceof Error && error.message.includes('existe déjà')) {
            return res.status(409).json({
                success: false,
                message: error.message
            })
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la soumission de votre candidature',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🟢 ROUTE PUBLIQUE - Vérifier le statut d'une candidature par email
Responsabilité : Permettre aux candidats de vérifier le statut de leur candidature*/

router.get('/status/:email', async (req: Request, res: Response) => {
    try {
        const email = req.params.email 

        if (!VolunteerService.isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Format d\'email invalide'
            })
        }

        const volunteer = await VolunteerService.getVolunteerByEmail(email)

        // Ne retourne que les informations non sensibles 
        res.json({
            success: true, 
            data: {
                firstname: volunteer.firstname,
                lastname: volunteer.lastname,
                email: volunteer.email,
                status: volunteer.status,
                createdAt: volunteer.createdAt
            }
        })
    } catch (error) {
        console.error('Erreur lors de la vérification du statut:', error)

        if (error instanceof Error && error.message === 'Candidature de bénévolat non trouvé') {
            return res.status(404).json({
                success: false,
                message: 'Aucune candidature trouvée avec cet email'
            })
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la vérification du statut',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* ---------------------- ROUTES ADMIN (Protégées) -------------------------
Responsabilité : Afficher toutes les candidatures de bénévolat pour l'administration*/

router.get('/admin/all', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const volunteers = await VolunteerService.getAllVolunteers()

        res.json({
            success: true,
            message: 'Liste des candidatures récupérée avec succès',
            data: volunteers 
        })
    } catch (error) {
        console.error('Erreur lors de la récupération des candidatures', error)

        res.status(500).json({
            succes: false,
            message: 'Erreur lors de la récupération des candidatures',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined 
        })
    }
})

/* 🔒 Routes Protégée Admin : Lister les candidatures par statut 
Resp : Filtrer les candidatures selon leur statut (pending/approved/rejected)*/ 

router.get('/admin/status/:status', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const status = req.params.status
        const volunteers = await VolunteerService.getVolunteersByStatus(status)

        res.json({
            success: true,
            message: `Candidatures avec le statut "${status}" récupérées avec succès`, 
            data: volunteers
        })
    } catch (error) {
        console.error('Erreur lors de la récupération par statut:', error)

        if (error instanceof Error && error.message.includes('Statut invalide')) {
            return res.status(400).json({
                success: false,
                message: error.message 
            })
        }

        res.status(500).json({
            success: false, 
            message: 'Erreur lors de la récupération des candidatures', 
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined 
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Récupérer une candidature par ID
Responsabilité : Afficher les détails complets d'une candidature spécifique*/

router.get('/admin/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const volunteerId = parseInt(req.params.id)

        if (isNaN(volunteerId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de candidature invalide'
            })
        }

        const volunteer = await VolunteerService.getVolunteerById(volunteerId)

        res.json({
            success: true,
            data: volunteer 
        })
    } catch (error) {
        console.error('Erreur lors de la récupération de la candidature:', error)

        if (error instanceof Error && error.message === 'Candidature de bénévolat non trouvée') {return res.status(404).json({
            success: false,
            message: error.message 
        })
    }
    
    res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de la candidature', 
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Approuver une candidature
Responsabilité : Marquer une candidature comme approuvée*/

router.patch('/admin/:id/approve', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const volunteerId = parseInt(req.params.id) 

        if (isNaN(volunteerId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de candidature invalide'
            })
        }

        const volunteer = await VolunteerService.approveVolunteer(volunteerId)

        res.json({
            success: true,
            message: 'Candidature approuvée avec succès', 
            data: volunteer 
        })
    } catch (error) {
        console.error('Erreur lors de l\'approbation:', error) 

        if (error instanceof Error) {
            if (error.message === 'Candidature de bénévolat non trouvée') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                })
            }
            if (error.message.includes('déjà approuvée')) {
                return res.status(400).json({
                    success: false,
                    message: error.message 
                })
            }
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'approbation de la candidature',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Rejeter une candidature
Responsabilité : Marquer une candidature comme rejetée*/

router.patch('/admin/:id/reject', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const volunteerId = parseInt(req.params.id) 

        if (isNaN(volunteerId)) {
            return res.status(400).json({
                    success: false,
                    message: 'ID de candidature invalide'
                
            })
        }

        const volunteer = await VolunteerService.rejectVolunteer(volunteerId)

        res.json({
            success: true,
            message: 'Candidature rejetée',
            data: volunteer
        })

    } catch (error) {
        console.error('Erreur lors du rejet:', error)

        if (error instanceof Error) {
            if (error.message === 'Candidature de bénévolat non trouvée') {
                return res.status(404).json({
                    success: false,
                    message: error.message 
                })
            }
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors du rejet de la candidature',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Remettre en attente une candidature
Responsabilité : Remettre le statut d'une candidature à "pending"*/

router.patch('/admin/:id/pending', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const volunteerId = parseInt(req.params.id) 

        if (isNaN(volunteerId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de candidature invalide'
            })
        }

        const volunteer = await VolunteerService.setPendingVolunteer(volunteerId)

        res.json({
            success: true,
            message: 'Candidature remise en attente', 
            data: volunteer
        })
    } catch (error) {
        console.error('Erreur lors de la remise en attente:', error)

        if (error instanceof Error && error.message === 'Candidature de bénévolat non trouvée') {
            return res.status(404).json({
                success: false, 
                message: error.message
            })
        }
        
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la remise en attente',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Mettre à jour une candidature
Responsabilité : Permettre aux admins de modifier les informations d'une candidature*/
router.put('/admin/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const volunteerId = parseInt(req.params.id)
        const updateData = req.body as UpdateVolunteerRequest

        if (isNaN(volunteerId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de candidature invalide'
            })
        }

        // Vérifier qu'au moins un champ est fourni pour la mise à jour 
        const hasData = Object.keys(updateData).length > 0
        if (!hasData) {
            return res.status(400).json({
                success: false,
                message: 'Vous devez fournir au moins un champ à mettre à jour'
            })
        }

        // Validations si les champs sont modifiés 
       if (updateData.email && !VolunteerService.isValidEmail(updateData.email)) {
            return res.status(400).json({
                success: false,
                message: 'Format d\'email invalide'
            })
        }

        if (updateData.phone && !VolunteerService.isValidPhone(updateData.phone)) {
            return res.status(400).json({
                success: false,
                message: 'Format de téléphone invalide'
            })
        }

        if (updateData.firstname && !VolunteerService.isValidName(updateData.firstname).valid) {
            return res.status(400).json({
                success: false,
                message: VolunteerService.isValidName(updateData.firstname).message
            })
        }

        if (updateData.lastname && !VolunteerService.isValidName(updateData.lastname).valid) {
            return res.status(400).json({
                success: false,
                message: VolunteerService.isValidName(updateData.lastname).message
            })
        }

        if (updateData.age && !VolunteerService.isValidAge(updateData.age).valid) {
            return res.status(400).json({
                success: false,
                message: VolunteerService.isValidAge(updateData.age).message
            })
        }
        
        const updatedVolunteer = await VolunteerService.updateVolunteer(volunteerId, updateData)

        res.json({
            success: true,
            message: 'Candidature mise à jour avec succès',
            data: updatedVolunteer
        })
    } catch (error) {
        console.error('Erreur lors de la mise à jour:', error)

        if (error instanceof Error) {
            if (error.message === 'Candidature de bénévolat non trouvée') {
                return res.status(404).json({
                    success: false,
                    message: error.message 
                })
            }
            if (error.message.includes('existe déjà')) {
                return res.status(409).json({
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
            message: 'Erreur lors de la mise à jour de la candidature', 
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Supprimer une candidature
Responsabilité : Supprimer définitivement une candidature du système*/

router.delete('/admin/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const volunteerId = parseInt(req.params.id) 

        if (isNaN(volunteerId)) {
            return res.status(400).json({
                success: false,
                message: 'ID de candidature invalide'
            })
        }

        const result = await VolunteerService.deleteVolunteer(volunteerId)

        res.json({
            success: true,
            message: result.message 
        })
    } catch (error) {
        console.error('Erreur lors de la suppression:', error)

        if (error instanceof Error && error.message === 'Candidature de bénévolat non trouvée') {
            return res.status(404).json({
                success: false,
                message: error.message
            })
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de la candidature', 
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined 
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Rechercher des candidatures
Responsabilité : Recherche avancée avec filtres pour l'administration*/
router.get('/admin/search', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const city = req.query.city as string | undefined
        const status = req.query.status as string | undefined  
        const minAge = req.query.minAge as string | undefined
        const maxAge = req.query.maxAge as string | undefined
        const skills = req.query.skills as string | undefined

        // Validation et conversion des paramètres 
        const filters: any = {}

        if (city) filters.city = city
        if (status) filters.status = status 
        if (skills) filters.skills = skills 

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
            if (isNaN(maxAgeNum) ||maxAgeNum < 0) {
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

        const volunteers = await VolunteerService.searchVolunteers(filters)

        res.json({
            success: true,
            message: `${volunteers.length} candidature(s) trouvée(s)`, 
            data: volunteers,
            filters: filters
        })
    } catch (error) {
        console.error('Erreur lors de la recherche.', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche de candidatures',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Statistiques des bénévoles
Responsabilité : Fournir un dashboard avec les statistiques des candidatures*/
router.get('/admin/stats', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const stats = await VolunteerService.getAllVolunteers()

        res.json({
            success: true,
            message: 'Statistiques des bénévoles récupérées avec succès', 
            data: stats 
        })

    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})


export default router 



/* 
🟢 Routes Publiques (pour les candidats)
- POST /aply = Soumettre sa candidature de bénévolat 
- GET /status/:email - Vérifier le statut de sa candidature 


🔒 Routes Admin (pour l'administration) 
- GET /admin/all - Toutes les candidatures 
- GET /admin/status/:status - Filtrer par statut (pending/approved/rejected)
- /admin/:id - Détails d'une candidature 
- PUT /admin/:id - Modifier une candidature 

Action sur les candidatures : 
- PATCH /admin/:id/approve - Approuver 
- PATCH /admin/:id/reject - Rejeter 
- PATCH /admin/:id/pending - Remettre en attente 
- DELETE /admin/:id - supprimer 

Outils d'administration : 
- GET /admin/search - Recherche avancée avec filtres 
- GET /admin/stats - Statistiques pour dashboard 

✨ Fonctionnalités clés :

✅ Validation complète (email, téléphone français, âge, noms)
✅ Gestion des doublons d'email
✅ Messages d'erreur explicites
✅ Recherche avec filtres (ville, âge, compétences, statut)
✅ Protection des données (seules les infos nécessaires pour le statut public)

*/