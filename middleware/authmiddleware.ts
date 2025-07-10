import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/authservice'


declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: number
                email: string
                role: string
            }
        }
    }
}

/* 
req : Contient les infos sur la requête entrante
res : Envoie la réponse
next : Est une fonction spéciale que j'appelle pour me dire que "tout va bien"
*/
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    try {
        // Recherche "le badge d'accès dans les headers". Les tokens sont envoyés dans le header 
        const authHeader = req.headers.authorization 
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Token d\'authentification manquant'
            })
        }
        
        // Cette ligne extrait le token en supprimant les 7 premiers caractères ("Bearer ") de la chaîne
        const token = authHeader.substring(7)
        
        // Le middleware demande à AuthService de vérifier que le token est authentique et toujours valide
        const decoded = AuthService.verifyToken(token)
        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: "Token invalide ou expiré"
            })
        }
        
        /* Si toutes les vérifications passent alors le middleware fait 2 choses cruciales :
        1 : Il enrichit req avec les infos de l'utilisateur du token 
        2 : Il appelle next() qui dit à Express "Tout va bien, continue vers la route demandée"
        */ 
        req.user = decoded
        next()
        
    } catch (error) {
        console.error('Erreur dans le middleware d\'authentification:', error)
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de l\'authentification'
        })
    }   
}

// Middleware pour vérifier que l'utilisateur est administrateur
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ 
            success: false,
            message: 'Authentification requise' 
        })
    }

    try {
        const isAdmin = await AuthService.isAdmin(req.user.userId)
        
        if (!isAdmin) {
            return res.status(403).json({ 
                success: false,
                message: 'Accès administrateur requis pour cette action'
            })
        }
        
        next()
    } catch (error) {
        console.error('Erreur vérification admin:', error)
        return res.status(500).json({ 
            success: false,
            message: 'Erreur lors de la vérification des permissions' 
        })
    }
}

// Middleware pour loguer les tentatives d'authentification (utile pour la sécurité)
export const logAuthAttempt = (req: Request, res: Response, next: NextFunction) => {
    const { email } = req.body
    const ip = req.ip || req.connection?.remoteAddress
    const userAgent = req.get('User-Agent')
    
    console.log(`[AUTH] Tentative - Email: ${email || 'N/A'}, IP: ${ip}, UserAgent: ${userAgent}`)
    next()
}
