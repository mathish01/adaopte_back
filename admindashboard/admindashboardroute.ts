import { Router, Request, Response } from "express"
import { authMiddleware, requireAdmin } from "../middleware/authmiddleware"
import { AdminDashboardService } from "../services/admindashboardservice"

const router = Router()

// ====================== ROUTES DASHBOARD ADMIN ======================

/* 🔒 ROUTE PROTÉGÉE ADMIN - Dashboard complet
Responsabilité : Récupérer toutes les données du dashboard administrateur
Inclut toutes les statistiques du site + activité récente */

router.get('/admin/dashboard', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const result = await AdminDashboardService.getAdminDashboard()

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Dashboard admin récupéré avec succès',
                data: result.data
            })
        } else {
            return res.status(500).json({
                success: false,
                message: result.error
            })
        }
    } catch (error) {
        console.error('Erreur lors de la récupération du dashboard admin:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du dashboard admin',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE ADMIN - Statistiques rapides
Responsabilité : Récupérer un résumé rapide pour widgets/cartes admin
Plus léger que le dashboard complet, pour les mises à jour fréquentes */

router.get('/admin/dashboard/stats', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const result = await AdminDashboardService.getAdminQuickStats()

        if (result.success) {
            return res.status(200).json({
                success: true,
                message: 'Statistiques admin récupérées avec succès',
                data: result.data
            })
        } else {
            return res.status(500).json({
                success: false,
                message: result.error
            })
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques admin:', error)

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques admin',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

export default router