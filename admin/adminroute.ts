import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authservice';
import { authMiddleware } from '../middleware/authmiddleware';

const router = Router();

// Middleware pour vérifier que l'utilisateur est admin
const adminMiddleware = async (req: Request, res: Response, next: any) => {
    try {
        const userId = req.user!.userId;
        const isAdmin = await AuthService.isAdmin(userId);
        
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Accès réservé aux administrateurs'
            });
        }
        
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Erreur lors de la vérification des permissions'
        });
    }
};

/* 🔒 ROUTE PROTÉGÉE ADMIN - Lister tous les admins */
router.get('/admins', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const admins = await AuthService.getAllAdmins();
        
        res.json({
            success: true,
            data: admins
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des admins:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des administrateurs'
        });
    }
});

/* 🔒 ROUTE PROTÉGÉE ADMIN - Promouvoir un utilisateur en admin */
router.post('/promote/:userId', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.userId);
        
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'ID utilisateur invalide'
            });
        }
        
        const success = await AuthService.promoteToAdmin(userId);
        
        if (success) {
            res.json({
                success: true,
                message: 'Utilisateur promu administrateur avec succès'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Erreur lors de la promotion'
            });
        }
    } catch (error) {
        console.error('Erreur lors de la promotion:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la promotion en administrateur'
        });
    }
});

/* 🔒 ROUTE PROTÉGÉE ADMIN - Rétrograder un admin en utilisateur */
router.post('/demote/:userId', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = parseInt(req.params.userId);
        const currentUserId = req.user!.userId;
        
        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'ID utilisateur invalide'
            });
        }
        
        // Empêcher un admin de se rétrograder lui-même
        if (userId === currentUserId) {
            return res.status(400).json({
                success: false,
                message: 'Vous ne pouvez pas vous rétrograder vous-même'
            });
        }
        
        const success = await AuthService.demoteFromAdmin(userId);
        
        if (success) {
            res.json({
                success: true,
                message: 'Administrateur rétrogradé en utilisateur avec succès'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Erreur lors de la rétrogradation'
            });
        }
    } catch (error) {
        console.error('Erreur lors de la rétrogradation:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la rétrogradation'
        });
    }
});

/* 🔒 ROUTE PROTÉGÉE ADMIN - Statistiques générales */
router.get('/stats', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
    try {
        // Tu peux étendre cette route avec des stats de ta DB
        const admins = await AuthService.getAllAdmins();
        
        res.json({
            success: true,
            data: {
                totalAdmins: admins.length,
                admins: admins
            }
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques'
        });
    }
});

/* 🔒 ROUTE PROTÉGÉE ADMIN - Vérifier si l'utilisateur actuel est admin */
router.get('/check', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const isAdmin = await AuthService.isAdmin(userId);
        
        res.json({
            success: true,
            data: {
                isAdmin: isAdmin,
                userId: userId
            }
        });
    } catch (error) {
        console.error('Erreur lors de la vérification admin:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la vérification'
        });
    }
});

export default router;