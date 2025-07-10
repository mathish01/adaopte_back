import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class AnimalService {
    
    // Créer un nouvel animal dans la base (pour les admins)
    static async createAnimal(animalData: {
        type: string
        name: string
        city: string
        age: number
        breed: string
        description?: string
    }) {
        
        // Validation des données obligatoires
        if (!animalData.type || !animalData.name || !animalData.city || !animalData.breed) {
            throw new Error("Tous les champs obligatoires doivent être renseignés")
        }

        if (animalData.age <= 0) {
            throw new Error("L'âge de l'animal doit être supérieur à 0")
        }

        // Créer l'animal avec le statut "available" par défaut
        const animal = await prisma.animal.create({
            data: {
                type: animalData.type.trim(),
                name: animalData.name.trim(),
                city: animalData.city.trim(),
                age: animalData.age,
                breed: animalData.breed.trim(),
                description: animalData.description?.trim() || null,
                status: 'available'
            }
        })

        return animal
    }

    // Récupérer tous les animaux disponibles à l'adoption
    static async getAvailableAnimals() {
        const animals = await prisma.animal.findMany({
            where: {
                status: 'available'
            },
            orderBy: {
                createdAt: 'desc' // Les plus récents en premier
            }
        })

        return animals
    }

    // Récupérer tous les animaux (pour les admins)
    static async getAllAnimals() {
        const animals = await prisma.animal.findMany({
            include: {
                adopt: {
                    include: {
                        users: {
                            select: {
                                id: true,
                                firstname: true,
                                lastname: true,
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        return animals
    }

    // Récupérer un animal par son ID
    static async getAnimalById(animalId: number) {
        const animal = await prisma.animal.findUnique({
            where: { id: animalId },
            include: {
                adopt: {
                    include: {
                        users: {
                            select: {
                                id: true,
                                firstname: true,
                                lastname: true,
                                email: true,
                                phone: true
                            }
                        }
                    }
                }
            }
        })

        if (!animal) {
            throw new Error('Animal non trouvé')
        }

        return animal
    }

    // Rechercher des animaux avec filtres
    static async searchAnimals(filters: {
        type?: string
        city?: string
        breed?: string
        minAge?: number
        maxAge?: number
        status?: string
    }) {
        
        // Construire les conditions de recherche
        const whereConditions: any = {}

        if (filters.type) {
            whereConditions.type = {
                contains: filters.type,
                mode: 'insensitive' // Recherche insensible à la casse
            }
        }

        if (filters.city) {
            whereConditions.city = {
                contains: filters.city,
                mode: 'insensitive'
            }
        }

        if (filters.breed) {
            whereConditions.breed = {
                contains: filters.breed,
                mode: 'insensitive'
            }
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

        // Par défaut, ne montrer que les animaux disponibles
        whereConditions.status = filters.status || 'available'

        const animals = await prisma.animal.findMany({
            where: whereConditions,
            orderBy: {
                createdAt: 'desc'
            }
        })

        return animals
    }

    // Mettre à jour les informations d'un animal
    static async updateAnimal(animalId: number, updateData: {
        type?: string
        name?: string
        city?: string
        age?: number
        breed?: string
        description?: string
        status?: string
    }) {
        
        // Vérifier que l'animal existe
        const existingAnimal = await prisma.animal.findUnique({
            where: { id: animalId }
        })

        if (!existingAnimal) {
            throw new Error('Animal non trouvé')
        }

        // Préparer les données à mettre à jour
        const cleanUpdateData: any = {}

        if (updateData.type !== undefined) {
            cleanUpdateData.type = updateData.type.trim()
        }
        if (updateData.name !== undefined) {
            cleanUpdateData.name = updateData.name.trim()
        }
        if (updateData.city !== undefined) {
            cleanUpdateData.city = updateData.city.trim()
        }
        if (updateData.age !== undefined) {
            if (updateData.age <= 0) {
                throw new Error("L'âge de l'animal doit être supérieur à 0")
            }
            cleanUpdateData.age = updateData.age
        }
        if (updateData.breed !== undefined) {
            cleanUpdateData.breed = updateData.breed.trim()
        }
        if (updateData.description !== undefined) {
            cleanUpdateData.description = updateData.description.trim() || null
        }
        if (updateData.status !== undefined) {
            // Valider les statuts autorisés
            const validStatuses = ['available', 'adopted', 'pending']
            if (!validStatuses.includes(updateData.status)) {
                throw new Error(`Statut invalide. Statuts autorisés: ${validStatuses.join(', ')}`)
            }
            cleanUpdateData.status = updateData.status
        }

        const updatedAnimal = await prisma.animal.update({
            where: { id: animalId },
            data: cleanUpdateData
        })

        return updatedAnimal
    }

    // Supprimer un animal (pour les admins)
    static async deleteAnimal(animalId: number) {
        
        // Vérifier que l'animal existe
        const existingAnimal = await prisma.animal.findUnique({
            where: { id: animalId },
            include: {
                adopt: true
            }
        })

        if (!existingAnimal) {
            throw new Error('Animal non trouvé')
        }

        // Vérifier qu'il n'y a pas d'adoptions en cours
        const pendingAdoptions = existingAnimal.adopt.filter(adoption => adoption.status === 'pending')
        if (pendingAdoptions.length > 0) {
            throw new Error('Impossible de supprimer un animal avec des demandes d\'adoption en cours')
        }

        await prisma.animal.delete({
            where: { id: animalId }
        })

        return { message: 'Animal supprimé avec succès' }
    }

    // Marquer un animal comme adopté
    static async markAsAdopted(animalId: number) {
        
        const animal = await prisma.animal.findUnique({
            where: { id: animalId }
        })

        if (!animal) {
            throw new Error('Animal non trouvé')
        }

        if (animal.status === 'adopted') {
            throw new Error('Cet animal est déjà adopté')
        }

        const updatedAnimal = await prisma.animal.update({
            where: { id: animalId },
            data: { status: 'adopted' }
        })

        return updatedAnimal
    }

    // Remettre un animal comme disponible
    static async markAsAvailable(animalId: number) {
        
        const animal = await prisma.animal.findUnique({
            where: { id: animalId }
        })

        if (!animal) {
            throw new Error('Animal non trouvé')
        }

        const updatedAnimal = await prisma.animal.update({
            where: { id: animalId },
            data: { status: 'available' }
        })

        return updatedAnimal
    }

    // Obtenir les statistiques des animaux (pour le dashboard admin)
    static async getAnimalStats() {
        
        const totalAnimals = await prisma.animal.count()
        
        const availableAnimals = await prisma.animal.count({
            where: { status: 'available' }
        })
        
        const adoptedAnimals = await prisma.animal.count({
            where: { status: 'adopted' }
        })
        
        const pendingAnimals = await prisma.animal.count({
            where: { status: 'pending' }
        })

        // Statistiques par type d'animal
        const animalsByType = await prisma.animal.groupBy({
            by: ['type'],
            _count: {
                id: true
            }
        })

        // Statistiques par ville
        const animalsByCity = await prisma.animal.groupBy({
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

        return {
            total: totalAnimals,
            available: availableAnimals,
            adopted: adoptedAnimals,
            pending: pendingAnimals,
            byType: animalsByType,
            byCity: animalsByCity
        }
    }

    /*
    Méthodes utilitaires pour la validation
    */
    
    // Valider les types d'animaux autorisés
    static isValidAnimalType(type: string): boolean {
        const validTypes = ['chien', 'chat', 'lapin', 'rongeur', 'oiseau', 'poisson', 'reptile']
        return validTypes.includes(type.toLowerCase())
    }

    // Valider que l'âge est cohérent
    static isValidAge(age: number): { valid: boolean; message?: string } {
        if (age <= 0) {
            return {
                valid: false,
                message: "L'âge doit être supérieur à 0"
            }
        }
        
        if (age > 30) {
            return {
                valid: false,
                message: "L'âge semble anormalement élevé"
            }
        }

        return { valid: true }
    }

    // Valider que le nom de l'animal est approprié
    static isValidAnimalName(name: string): { valid: boolean; message?: string } {
        if (name.trim().length < 2) {
            return {
                valid: false,
                message: "Le nom de l'animal doit contenir au moins 2 caractères"
            }
        }

        if (name.trim().length > 50) {
            return {
                valid: false,
                message: "Le nom de l'animal ne peut pas dépasser 50 caractères"
            }
        }

        return { valid: true }
    }
}