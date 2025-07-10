import bcrypt from 'bcryptjs';
import JWT, { SignOptions } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient()

export class AuthService {
    private static readonly SALT_ROUNDS = 12 
    private static readonly JWT_SECRET = process.env.JWT_SECRET || 'adalicious-fallback-secret'
    private static readonly JWT_EXPIRES: string | number = process.env.JWT_EXPIRES_IN || '30d'

      private static readonly ADMIN_EMAILS = [
        'admin@adaopte.com', // ✅ Remplace par ton email
        'manager@adaopte.com'
    ];

    // 🆕 AJOUTER ICI - Méthode pour déterminer le rôle
    private static determineUserRole(email: string): 'admin' | 'user' {
        return this.ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : 'user';
    }

    // Hache un mot de passe avec bcrypt pour le sécuriser avant stockage en base
    static async hashPassword(password: string): Promise<string> {
        return await bcrypt.hash(password, this.SALT_ROUNDS)
    }

    // Compare un mot de passe en clair avec son équivalent haché stocké en base
    static async comparePassword(password: string, hash: string): Promise<boolean> {
        return await bcrypt.compare(password, hash)
    }

    // Génère un token JWT contenant les informations essentielles de l'utilisateur
    static generateToken(userId: number, email: string, role: string = 'user'): string {
        const options: SignOptions = {
            expiresIn: this.JWT_EXPIRES as any
        }
        
        return JWT.sign(
            { userId, email, role },
            this.JWT_SECRET,
            options
        )
    }

    // Vérifie la validité d'un token JWT et extrait les données utilisateur
    static verifyToken(token: string): { userId: number; email: string; role: string } | null {
        try {
            return JWT.verify(token, this.JWT_SECRET) as { userId: number; email: string; role: string }
        } catch (error) {
            return null 
        }
    }

    // Inscription d'un nouvel utilisateur sur la plateforme d'adoption
    static async register(userData: {
        firstname: string 
        lastname: string
        email: string
        password: string
        phone?: string
    }) {
        
        // Vérifier si l'email existe déjà dans notre base de données
        const existingUser = await prisma.user.findUnique({
            where: { email: userData.email }
        })

        if (existingUser) {
            throw new Error("Un utilisateur avec cet email existe déjà")
        }
        
        // Hasher le mot de passe pour la sécurité avant de le stocker
        const hashedPassword = await this.hashPassword(userData.password)

        const role = this.determineUserRole(userData.email); 

        // Créer le nouvel utilisateur dans la table user
        const user = await prisma.user.create({
            data: {
                firstname: userData.firstname,
                lastname: userData.lastname,
                email: userData.email,
                password: hashedPassword, // ✅ Utilise le hash, pas le mot de passe en clair
                phone: userData.phone,
                role: role // Tous les nouveaux utilisateurs sont des utilisateurs normaux
            }
        })

        // Générer le token JWT pour authentifier automatiquement l'utilisateur
        const token = this.generateToken(user.id, user.email, user.role || 'user')

        // Retourner les données utilisateur (sans le mot de passe) + token 
        return {
            user: {
                id: user.id,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                phone: user.phone,
                role: user.role,
                createdAt: user.createdAt 
            },
            token 
        }
    }

    /* 
    Connexion d'un utilisateur existant
    Gère : vérification email, vérification mot de passe et génération token
    */
    static async login(email: string, password: string) {
        const user = await prisma.user.findUnique({
            where: { email }
        })

        if (!user) {
            throw new Error('Email ou mot de passe incorrect')
        }

        // ✅ Vérifie le mot de passe en le comparant avec le hash stocké
        const isPasswordValid = await this.comparePassword(password, user.password)
        
        if (!isPasswordValid) {
            throw new Error('Email ou mot de passe incorrect')
        }

          //  Vérifier et mettre à jour le rôle si nécessaire
        const expectedRole = this.determineUserRole(email);
        let finalRole = user.role || 'user';

        if (expectedRole !== user.role) {
            // Mettre à jour le rôle en base
            await prisma.user.update({
                where: { id: user.id },
                data: { role: expectedRole }
            });
            finalRole = expectedRole;
            console.log(`🔄 Rôle mis à jour pour ${email}: ${finalRole}`);
        }


        // Génère le token pour authentifier la session utilisateur
        const token = this.generateToken(user.id, user.email, user.role || 'user')

        // Retourne les données utilisateur (sans le mdp) + token 
        return {
            user: {
                id: user.id,
                firstname: user.firstname,
                lastname: user.lastname, 
                email: user.email,
                phone: user.phone,
                role: user.role,
                createdAt: user.createdAt
            },
            token
        }
    }

    /*
    Récupère le profil complet d'un utilisateur par son ID
    Inclut son historique d'adoptions pour afficher ses animaux adoptés
    */
    static async getUserProfile(userId: number) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                firstname: true,
                lastname: true,
                email: true,
                phone: true,
                role: true,
                createdAt: true,
                adopt: {
                    include: {
                        animal: {
                            select: {
                                id: true,
                                name: true,
                                type: true,
                                breed: true,
                                age: true,
                                city: true,
                                status: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
                // password volontairement exclu pour la sécurité
            }
        })

        if (!user) {
            throw new Error('Utilisateur non trouvé')
        }

        return user
    }

    /*
    Mettre à jour le profil d'utilisateur 
    Gère: la validation email unique, le nettoyage des données et la mise à jour sélective
    */
   static async updateUserProfile(userId: number, updateData: {
    firstname?: string
    lastname?: string
    email?: string
    phone?: string
   }) {
    const existingUser = await prisma.user.findUnique({
        where: { id: userId }
    })

    if (!existingUser) {
        throw new Error('Utilisateur non trouvé')
    }

    // Si l'email est modifié, vérifier qu'il n'est pas déjà utilisé par un autre utilisateur
    if (updateData.email && updateData.email !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({
            where:  { email: updateData.email }
        })

        if (emailExists) {
            throw new Error('Un utilisateur avec cet email existe déjà')
        }
    }

    // Préparer les données à mettre à jour en nettoyant les entrées utilisateur
    const cleanUpdateData: any = {}

    if (updateData.firstname !== undefined) {
        cleanUpdateData.firstname = updateData.firstname.trim()
    }
    if (updateData.lastname !== undefined) {
        cleanUpdateData.lastname = updateData.lastname.trim()
    }
    if (updateData.email !== undefined) {
        cleanUpdateData.email = updateData.email.trim().toLowerCase()
    } 
    if (updateData.phone !== undefined) {
        // Si phone est une chaîne vide, le mettre à null pour permettre la suppression
        cleanUpdateData.phone = updateData.phone.trim() || null 
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: cleanUpdateData,
        select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
            phone: true,
            role: true,
            createdAt: true
            // password volontairement exclu pour la sécurité
        }
    })

    return updatedUser
   }

   // Vérifie si un utilisateur a le rôle admin (utile pour gérer les animaux)
   static async isAdmin(userId: number): Promise<boolean> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        })
        
        return user?.role === 'admin'
    } catch (error) {
        return false
    }
   }

    /*
   Méthode utilitaire pour valider le format email 
   Centralisée ici pour éviter la duplication dans les routes 
    */
   static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
   }

   /*
   Méthode utilitaire pour valider la force du mot de passe
   Centralisée ici pour une logique cohérente sur toute la plateforme
   */
   static isValidPassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 6) {
        return {
            valid: false,
            message: 'Le mot de passe doit contenir au moins 6 caractères'
        }
    }

    return { valid: true }
   }

    // Méthode pour promouvoir un utilisateur en admin
   static async promoteToAdmin(userId: number): Promise<boolean> {
        try {
            await prisma.user.update({
                where: { id: userId },
                data: { role: 'admin' }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    // Méthode pour rétrograder un admin en user
    static async demoteFromAdmin(userId: number): Promise<boolean> {
        try {
            await prisma.user.update({
                where: { id: userId },
                data: { role: 'user' }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    // Lister tous les admins
    static async getAllAdmins() {
        return await prisma.user.findMany({
            where: { role: 'admin' },
            select: {
                id: true,
                firstname: true,
                lastname: true,
                email: true,
                createdAt: true
            }
        });
    }
}

// Utilisation de JWT (JSON Web token) + bcryptjs + Middleware Express 

/*  
1) Je hache les mots de passe (bcryptjs)
2) Je Génère le token JWT
3) Vérification des tokens 
4) Le middleware d'authentification
5) Middleware admin 
------------------------------------------------------------------------

Inscription :
1. User saisit ses données
2. Backend hash le mot de passe avec bcryptjs
3. Stockage en base avec hash (pas le mot de passe original)
4. Génération d'un JWT token
5. Retour token + données user au frontend

-------------------------------------------------------------------------

Connexion :
1. User saisit email/password
2. Backend récupère le hash stocké en base
3. Comparaison bcryptjs du password saisi vs hash stocké
4. Si OK : génération JWT token
5. Retour token + données user au frontend

----------------------------------------------------------------------------

Requêtes protégées :
1. Frontend envoie token dans header "Authorization: Bearer TOKEN"
2. Middleware authMiddleware intercepte
3. Vérification JWT avec clé secrète
4. Si valide : req.user = données décodées du token
5. Route peut accéder aux infos user via req.user
*/