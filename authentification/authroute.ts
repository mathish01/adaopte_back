import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authservice'
import { authMiddleware, logAuthAttempt } from '../middleware/authmiddleware';

const router = Router()

// Interfaces pour typer les données reçues dans les requêtes
interface RegisterRequest {
    firstname: string
    lastname: string
    email: string
    password: string
    phone?: string 
}

interface LoginRequest {
    email: string
    password: string
}

interface UpdateProfileRequest {
    firstname?: string
    lastname?: string
    email?: string
    phone?: string
}

/* 🟢 ROUTE PUBLIQUE - Inscription
Responsabilité : Validation des données d'entrée + gestion des réponses HTTP
La logique métier est déléguée à AuthService.register()
*/
router.post('/register', logAuthAttempt, async (req: Request, res: Response) => {
    try {
        const { firstname, lastname, email, password, phone } = req.body as RegisterRequest

        if (!firstname || !lastname || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs sont requis (firstname, lastname, email, password)'
            })
        }

        // Validation du format email (utilise la méthode centralisée du service)
        if (!AuthService.isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Format d\'email invalide'
            })
        }

        // Validation du mot de passe (utilise la méthode centralisée du service)
        const passwordValidation = AuthService.isValidPassword(password)
        if (!passwordValidation.valid) {
            return res.status(400).json({
                success: false,
                message: passwordValidation.message
            })
        }

        // Délégation de toute la logique métier au service 
        const result = await AuthService.register({
            firstname: firstname.trim(),
            lastname: lastname.trim(),
            email: email.trim().toLowerCase(),
            password,
            phone: phone?.trim()
        })

        // Formatage de la réponse HTTP de succès
        res.status(201).json({
            success: true,
            message: 'Utilisateur créé avec succès',
            data: result
        })
        
    } catch (error) {
        console.error('Erreur lors de l\'inscription:', error)

        // Gestion des erreurs métier retournées par le service 
        if (error instanceof Error && error.message.includes('existe déjà')) {
            return res.status(409).json({
                success: false,
                message: error.message
            })
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'inscription',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🟢 ROUTE PUBLIQUE - Connexion
Responsabilité : validation des données d'entrée + gestion des réponses HTTP
La logique métier est déléguée à AuthService.login()
*/
router.post('/login', logAuthAttempt, async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body as LoginRequest

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email et mot de passe requis'
            })
        }

        const result = await AuthService.login(email.trim().toLowerCase(), password)

        res.json({
            success: true,
            message: 'Connexion réussie',
            data: result
        })
        
    } catch (error) {
        console.error('Erreur lors de la connexion:', error)

        if (error instanceof Error && error.message.includes('incorrect')) {
            return res.status(401).json({
                success: false,
                message: error.message
            })
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la connexion',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE - Voir son profil
Responsabilité : extraction de l'userId du token + gestion des réponses HTTP
Déléguée à AuthService.getUserProfile()
*/
router.get('/profile', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId

        const user = await AuthService.getUserProfile(userId)

        res.json({
            success: true,
            data: user
        })
        
    } catch (error) {
        console.error('Erreur lors de la récupération du profil:', error)
        
        // Gestion des erreurs métier retournées par le service 
        if (error instanceof Error && error.message === 'Utilisateur non trouvé') {
            return res.status(404).json({
                success: false,
                message: error.message
            })
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du profil'
        })
    }
})

/* 🔒 ROUTE PROTÉGÉE - Modifier son profil
Responsabilité : validation des données d'entrée + gestion des réponses HTTP
Déléguée à AuthService.updateUserProfile()
*/
router.put('/profile', authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId
        const { firstname, lastname, email, phone } = req.body as UpdateProfileRequest

        if (!firstname && !lastname && !email && !phone) {
            return res.status(400).json({
                success: false,
                message: "Vous devez fournir au moins un champ à mettre à jour"
            })
        }

        if (email && !AuthService.isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Format d'email invalide"
            })
        }

        if ((firstname !== undefined && firstname.trim() === "") || 
            (lastname !== undefined && lastname.trim() === "") ||
            (email !== undefined && email.trim() === "")) {
                return res.status(400).json({
                    success: false,
                    message: "Les champs texte ne peuvent pas être vides"
                })
        }

       // Délégation de toute la logique métier au service
       const updatedUser = await AuthService.updateUserProfile(userId, {
        firstname,
        lastname,
        email,
        phone
       })

        res.json({
            success: true,
            message: "Profil mis à jour avec succès",
            data: updatedUser
        })
        
    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error)

        if (error instanceof Error) {
           if (error.message === 'Utilisateur non trouvé') {
            return res.status(404).json({
                success: false,
                message: error.message 
            })
           }
           if (error.message.includes("existe déjà")) {
            return res.status(409).json({
                success: false,
                message: error.message 
            })
           }
        }

        res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour du profil'
        })
    }
})

export default router