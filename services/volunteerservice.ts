import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class VolunteerService {
    
    // Créer une nouvelle candidature de bénévolat
    static async createVolunteerApplication(volunteerData: {
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
    }) {
        
        // Validation des données obligatoires
        if (!volunteerData.firstname || !volunteerData.lastname || !volunteerData.email || !volunteerData.phone || !volunteerData.city) {
            throw new Error("Tous les champs obligatoires doivent être renseignés")
        }

        if (volunteerData.age < 16) {
            throw new Error("Vous devez avoir au moins 16 ans pour devenir bénévole")
        }

        if (volunteerData.age > 120) {
            throw new Error("Âge invalide")
        }

        // Vérifier si l'email existe déjà dans les candidatures
        const existingVolunteer = await prisma.volunteer.findUnique({
            where: { email: volunteerData.email }
        })

        if (existingVolunteer) {
            throw new Error("Une candidature avec cet email existe déjà")
        }

        // Créer la candidature de bénévolat
        const volunteer = await prisma.volunteer.create({
            data: {
                firstname: volunteerData.firstname.trim(),
                lastname: volunteerData.lastname.trim(),
                email: volunteerData.email.trim().toLowerCase(),
                phone: volunteerData.phone.trim(),
                city: volunteerData.city.trim(),
                age: volunteerData.age,
                motivation: volunteerData.motivation?.trim() || null,
                experience: volunteerData.experience?.trim() || null,
                availability: volunteerData.availability?.trim() || null,
                skills: volunteerData.skills?.trim() || null,
                status: 'pending'
            }
        })

        return volunteer
    }

    // Récupérer toutes les candidatures (pour les admins)
    static async getAllVolunteers() {
        const volunteers = await prisma.volunteer.findMany({
            orderBy: {
                createdAt: 'desc'
            }
        })

        return volunteers
    }

    // Récupérer les candidatures par statut
    static async getVolunteersByStatus(status: string) {
        const validStatuses = ['pending', 'approved', 'rejected']
        
        if (!validStatuses.includes(status)) {
            throw new Error(`Statut invalide. Statuts autorisés: ${validStatuses.join(', ')}`)
        }

        const volunteers = await prisma.volunteer.findMany({
            where: { status },
            orderBy: {
                createdAt: 'desc'
            }
        })

        return volunteers
    }

    // Récupérer une candidature par ID
    static async getVolunteerById(volunteerId: number) {
        const volunteer = await prisma.volunteer.findUnique({
            where: { id: volunteerId }
        })

        if (!volunteer) {
            throw new Error('Candidature de bénévolat non trouvée')
        }

        return volunteer
    }

    // Récupérer une candidature par email
    static async getVolunteerByEmail(email: string) {
        const volunteer = await prisma.volunteer.findUnique({
            where: { email: email.trim().toLowerCase() }
        })

        if (!volunteer) {
            throw new Error('Candidature de bénévolat non trouvée')
        }

        return volunteer
    }

    // Approuver une candidature (pour les admins)
    static async approveVolunteer(volunteerId: number) {
        const volunteer = await prisma.volunteer.findUnique({
            where: { id: volunteerId }
        })

        if (!volunteer) {
            throw new Error('Candidature de bénévolat non trouvée')
        }

        if (volunteer.status === 'approved') {
            throw new Error('Cette candidature est déjà approuvée')
        }

        const updatedVolunteer = await prisma.volunteer.update({
            where: { id: volunteerId },
            data: { status: 'approved' }
        })

        return updatedVolunteer
    }

    // Rejeter une candidature (pour les admins)
    static async rejectVolunteer(volunteerId: number) {
        const volunteer = await prisma.volunteer.findUnique({
            where: { id: volunteerId }
        })

        if (!volunteer) {
            throw new Error('Candidature de bénévolat non trouvée')
        }

        if (volunteer.status === 'rejected') {
            throw new Error('Cette candidature est déjà rejetée')
        }

        const updatedVolunteer = await prisma.volunteer.update({
            where: { id: volunteerId },
            data: { status: 'rejected' }
        })

        return updatedVolunteer
    }

    // Remettre une candidature en attente (pour les admins)
    static async setPendingVolunteer(volunteerId: number) {
        const volunteer = await prisma.volunteer.findUnique({
            where: { id: volunteerId }
        })

        if (!volunteer) {
            throw new Error('Candidature de bénévolat non trouvée')
        }

        const updatedVolunteer = await prisma.volunteer.update({
            where: { id: volunteerId },
            data: { status: 'pending' }
        })

        return updatedVolunteer
    }

    // Supprimer une candidature (pour les admins)
    static async deleteVolunteer(volunteerId: number) {
        const volunteer = await prisma.volunteer.findUnique({
            where: { id: volunteerId }
        })

        if (!volunteer) {
            throw new Error('Candidature de bénévolat non trouvée')
        }

        await prisma.volunteer.delete({
            where: { id: volunteerId }
        })

        return { message: 'Candidature de bénévolat supprimée avec succès' }
    }

    // Mettre à jour une candidature
    static async updateVolunteer(volunteerId: number, updateData: {
        firstname?: string
        lastname?: string
        email?: string
        phone?: string
        city?: string
        age?: number
        motivation?: string
        experience?: string
        availability?: string
        skills?: string
        status?: string
    }) {
        
        // Vérifier que la candidature existe
        const existingVolunteer = await prisma.volunteer.findUnique({
            where: { id: volunteerId }
        })

        if (!existingVolunteer) {
            throw new Error('Candidature de bénévolat non trouvée')
        }

        // Si l'email est modifié, vérifier qu'il n'est pas déjà utilisé
        if (updateData.email && updateData.email !== existingVolunteer.email) {
            const emailExists = await prisma.volunteer.findUnique({
                where: { email: updateData.email.trim().toLowerCase() }
            })

            if (emailExists) {
                throw new Error('Une candidature avec cet email existe déjà')
            }
        }

        // Préparer les données à mettre à jour
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
            cleanUpdateData.phone = updateData.phone.trim()
        }
        if (updateData.city !== undefined) {
            cleanUpdateData.city = updateData.city.trim()
        }
        if (updateData.age !== undefined) {
            if (updateData.age < 16 || updateData.age > 100) {
                throw new Error("L'âge doit être entre 16 et 100 ans")
            }
            cleanUpdateData.age = updateData.age
        }
        if (updateData.motivation !== undefined) {
            cleanUpdateData.motivation = updateData.motivation.trim() || null
        }
        if (updateData.experience !== undefined) {
            cleanUpdateData.experience = updateData.experience.trim() || null
        }
        if (updateData.availability !== undefined) {
            cleanUpdateData.availability = updateData.availability.trim() || null
        }
        if (updateData.skills !== undefined) {
            cleanUpdateData.skills = updateData.skills.trim() || null
        }
        if (updateData.status !== undefined) {
            const validStatuses = ['pending', 'approved', 'rejected']
            if (!validStatuses.includes(updateData.status)) {
                throw new Error(`Statut invalide. Statuts autorisés: ${validStatuses.join(', ')}`)
            }
            cleanUpdateData.status = updateData.status
        }

        const updatedVolunteer = await prisma.volunteer.update({
            where: { id: volunteerId },
            data: cleanUpdateData
        })

        return updatedVolunteer
    }

    // Obtenir les statistiques des bénévoles (pour le dashboard admin)
    static async getVolunteerStats() {
        
        const totalVolunteers = await prisma.volunteer.count()
        
        const pendingVolunteers = await prisma.volunteer.count({
            where: { status: 'pending' }
        })
        
        const approvedVolunteers = await prisma.volunteer.count({
            where: { status: 'approved' }
        })
        
        const rejectedVolunteers = await prisma.volunteer.count({
            where: { status: 'rejected' }
        })

        // Statistiques par ville
        const volunteersByCity = await prisma.volunteer.groupBy({
            by: ['city'],
            _count: {
                id: true
            },
            orderBy: {
                _count: {
                    id: 'desc'
                }
            },
            take: 10 // Top 10 des villes
        })

        // Statistiques par tranche d'âge
        const volunteersByAge = await prisma.volunteer.groupBy({
            by: ['age'],
            _count: {
                id: true
            },
            orderBy: {
                age: 'asc'
            }
        })

        return {
            total: totalVolunteers,
            pending: pendingVolunteers,
            approved: approvedVolunteers,
            rejected: rejectedVolunteers,
            byCity: volunteersByCity,
            byAge: volunteersByAge
        }
    }

    // Rechercher des bénévoles avec filtres
    static async searchVolunteers(filters: {
        city?: string
        status?: string
        minAge?: number
        maxAge?: number
        skills?: string
    }) {
        
        // Construire les conditions de recherche
        const whereConditions: any = {}

        if (filters.city) {
            whereConditions.city = {
                contains: filters.city,
                mode: 'insensitive'
            }
        }

        if (filters.status) {
            whereConditions.status = filters.status
        }

        if (filters.minAge !== undefined || filters.maxAge !== undefined) {
            whereConditions.age = {}
            if (filters.minAge !== undefined) {
                whereConditions.age.gte = filters.minAge
            }
            if (filters.maxAge !== undefined) {
                whereConditions.age.lte = filters.maxAge
            }
        }

        if (filters.skills) {
            whereConditions.skills = {
                contains: filters.skills,
                mode: 'insensitive'
            }
        }

        const volunteers = await prisma.volunteer.findMany({
            where: whereConditions,
            orderBy: {
                createdAt: 'desc'
            }
        })

        return volunteers
    }

    /*
    Méthodes utilitaires pour la validation
    */
    
    // Valider le format email
    static isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
    }

    // Valider le format téléphone français
    static isValidPhone(phone: string): boolean {
        const phoneRegex = /^(?:(?:\+33|0)[1-9](?:[0-9]{8}))$/
        return phoneRegex.test(phone.replace(/[\s.-]/g, ''))
    }

    // Valider l'âge minimum pour être bénévole
    static isValidAge(age: number): { valid: boolean; message?: string } {
        if (age < 16) {
            return {
                valid: false,
                message: 'Vous devez avoir au moins 16 ans pour devenir bénévole'
            }
        }
        
        if (age > 100) {
            return {
                valid: false,
                message: 'Âge invalide'
            }
        }

        return { valid: true }
    }

    // Valider que les champs texte ne sont pas vides
    static isValidName(name: string): { valid: boolean; message?: string } {
        if (name.trim().length < 2) {
            return {
                valid: false,
                message: 'Le nom doit contenir au moins 2 caractères'
            }
        }

        if (name.trim().length > 100) {
            return {
                valid: false,
                message: 'Le nom ne peut pas dépasser 100 caractères'
            }
        }

        return { valid: true }
    }
}