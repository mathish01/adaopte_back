import { Router, Request, Response } from "express"
import { authMiddleware } from "../middleware/authmiddleware"
import { UserDashboardService } from "../services/userdashboardservice"

const router = Router()

// ====================== ROUTES DASHBOARD UTILISATEUR ======================

/* 🔒 ROUTE PROTÉGÉE UTILISATEUR - Dashboard complet
Responsabilité : Récupérer toutes les données du dashboard utilisateur
Inclut dons de l'année + adoptions + statistiques */

router.get('/dashboard', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId

        const result = await UserDashboardService.getUserDashboard(userId)

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Dashboard récupéré avec succès',
                data: result.data
            })
        } else {
            return res.status(500).json({
                success: false,
                message: result.error
            })
        }
    } catch (error) {
        console.error('Erreur lors de la récupération du dashboard:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du dashboard',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE UTILISATEUR - Mes dons par année
Responsabilité : Récupérer les dons d'une année spécifique
Permet de voir l'historique sur plusieurs années */

router.get('/dashboard/donations', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId
        const year = req.query.year ? parseInt(req.query.year as string) : undefined

        // Validation de l'année si fournie
        if (year && (isNaN(year) || year < 2020 || year > new Date().getFullYear() + 1)) {
            return res.status(400).json({
                success: false,
                message: 'Année invalide'
            })
        }

        const result = await UserDashboardService.getUserDonations(userId, year)

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Dons récupérés avec succès',
                data: result.data
            })
        } else {
            return res.status(500).json({
                success: false,
                message: result.error
            })
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des dons:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des dons',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE UTILISATEUR - Mes adoptions
Responsabilité : Récupérer toutes les adoptions de l'utilisateur
Avec les détails des animaux */

router.get('/dashboard/adoptions', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId

        const result = await UserDashboardService.getUserAdoptions(userId)

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Adoptions récupérées avec succès',
                data: result.data
            })
        } else {
            return res.status(500).json({
                success: false,
                message: result.error
            })
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des adoptions:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des adoptions',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE UTILISATEUR - Statistiques rapides
Responsabilité : Récupérer un résumé rapide pour widgets/cartes
Plus léger que le dashboard complet */

router.get('/dashboard/stats', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId

        const result = await UserDashboardService.getUserQuickStats(userId)

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Statistiques récupérées avec succès',
                data: result.data
            })
        } else {
            return res.status(500).json({
                success: false,
                message: result.error
            })
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

export default router