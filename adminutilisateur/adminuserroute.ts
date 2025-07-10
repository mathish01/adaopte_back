import { Router, Request, Response } from "express"
import { authMiddleware, requireAdmin } from "../middleware/authmiddleware"
import { AdminUserService } from "../services/adminuserservice"

const router = Router()

// ====================== ROUTES GESTION UTILISATEURS ADMIN ======================

/* 🔒 ROUTE PROTÉGÉE ADMIN - Liste tous les utilisateurs
Responsabilité : Récupérer tous les utilisateurs avec leurs statistiques
Inclut nombre d'adoptions, dons, etc. */

router.get('/admin/users', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        console.log('🔥 Route GET /admin/users appelée par admin:', req.user!.userId)

        const result = await AdminUserService.getAllUsers()

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Utilisateurs récupérés avec succès',
                data: result.data
            })
        } else {
            return res.status(500).json({
                success: false,
                message: result.error
            })
        }
    } catch (error) {
        console.error('❌ Erreur lors de la récupération des utilisateurs:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des utilisateurs',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Récupérer un utilisateur par ID
Responsabilité : Récupérer les détails complets d'un utilisateur spécifique
Inclut toutes ses adoptions, dons, messages, etc. */

router.get('/admin/users/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.id)

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'ID utilisateur invalide'
            })
        }

        console.log('🔥 Route GET /admin/users/:id appelée pour userId:', userId)

        const result = await AdminUserService.getUserById(userId)

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Utilisateur récupéré avec succès',
                data: result.data
            })
        } else {
            return res.status(404).json({
                success: false,
                message: result.error
            })
        }
    } catch (error) {
        console.error('❌ Erreur lors de la récupération de l\'utilisateur:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'utilisateur',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Créer un nouvel utilisateur
Responsabilité : Créer un nouvel utilisateur dans le système
Génère un mot de passe temporaire si non fourni */

router.post('/admin/users', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const { firstname, lastname, email, phone, role, password } = req.body

        // Validation des champs requis
        if (!firstname || !lastname || !email || !role) {
            return res.status(400).json({
                success: false,
                message: 'Les champs firstname, lastname, email et role sont requis'
            })
        }

        // Validation du rôle
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Le rôle doit être "user" ou "admin"'
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

        console.log('🔥 Route POST /admin/users appelée pour créer:', firstname, lastname)

        const result = await AdminUserService.createUser({
            firstname,
            lastname,
            email,
            phone,
            role,
            password
        })

        if (result.success) {
            return res.status(201).json({
                success: true,
                message: 'Utilisateur créé avec succès',
                data: result.data
            })
        } else {
            return res.status(400).json({
                success: false,
                message: result.error
            })
        }
    } catch (error) {
        console.error('❌ Erreur lors de la création de l\'utilisateur:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de l\'utilisateur',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Modifier un utilisateur
Responsabilité : Mettre à jour les informations d'un utilisateur
Permet de modifier tous les champs sauf le mot de passe */

router.put('/admin/users/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.id)
        const updateData = req.body

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'ID utilisateur invalide'
            })
        }

        // Validation du rôle si fourni
        if (updateData.role && !['user', 'admin'].includes(updateData.role)) {
            return res.status(400).json({
                success: false,
                message: 'Le rôle doit être "user" ou "admin"'
            })
        }

        // Validation de l'email si fourni
        if (updateData.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(updateData.email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Format d\'email invalide'
                })
            }
        }

        console.log('🔥 Route PUT /admin/users/:id appelée pour userId:', userId)

        const result = await AdminUserService.updateUser(userId, updateData)

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Utilisateur modifié avec succès',
                data: result.data
            })
        } else {
            return res.status(400).json({
                success: false,
                message: result.error
            })
        }
    } catch (error) {
        console.error('❌ Erreur lors de la modification de l\'utilisateur:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la modification de l\'utilisateur',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Supprimer un utilisateur
Responsabilité : Supprimer définitivement un utilisateur du système
⚠️ ATTENTION : Supprime aussi toutes ses données (adoptions, dons, etc.) */

router.delete('/admin/users/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.id)
        const adminUserId = req.user!.userId

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'ID utilisateur invalide'
            })
        }

        // Empêcher un admin de se supprimer lui-même
        if (userId === adminUserId) {
            return res.status(400).json({
                success: false,
                message: 'Vous ne pouvez pas supprimer votre propre compte'
            })
        }

        console.log('🔥 Route DELETE /admin/users/:id appelée pour userId:', userId)

        const result = await AdminUserService.deleteUser(userId)

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Utilisateur supprimé avec succès'
            })
        } else {
            return res.status(400).json({
                success: false,
                message: result.error
            })
        }
    } catch (error) {
        console.error('❌ Erreur lors de la suppression de l\'utilisateur:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression de l\'utilisateur',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Changer le rôle d'un utilisateur
Responsabilité : Changer le rôle d'un utilisateur (user ↔ admin)
Route spécialisée pour la gestion des rôles */

router.patch('/admin/users/:id/role', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.id)
        const { role } = req.body
        const adminUserId = req.user!.userId

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'ID utilisateur invalide'
            })
        }

        if (!role || !['user', 'admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Le rôle doit être "user" ou "admin"'
            })
        }

        // Empêcher un admin de changer son propre rôle
        if (userId === adminUserId) {
            return res.status(400).json({
                success: false,
                message: 'Vous ne pouvez pas modifier votre propre rôle'
            })
        }

        console.log('🔥 Route PATCH /admin/users/:id/role appelée pour userId:', userId, 'nouveau rôle:', role)

        const result = await AdminUserService.changeUserRole(userId, role)

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: `Rôle changé vers "${role}" avec succès`,
                data: result.data
            })
        } else {
            return res.status(400).json({
                success: false,
                message: result.error
            })
        }
    } catch (error) {
        console.error('❌ Erreur lors du changement de rôle:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors du changement de rôle',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Statistiques des utilisateurs
Responsabilité : Récupérer des statistiques rapides sur les utilisateurs
Pour dashboard admin et widgets */

router.get('/admin/users-stats', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        console.log('🔥 Route GET /admin/users-stats appelée')

        const result = await AdminUserService.getUserStats()

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Statistiques utilisateurs récupérées avec succès',
                data: result.data
            })
        } else {
            return res.status(500).json({
                success: false,
                message: result.error
            })
        }
    } catch (error) {
        console.error('❌ Erreur lors de la récupération des statistiques utilisateurs:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

export default router