import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DonationData {
  userid?: number;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  amount: number;
  message?: string;
  isAnonymous?: boolean;
  paymentMethod?: string;
  paymentId?: string;
}

export interface DonationUpdateData {
  status?: string;
  paymentId?: string;
  paymentMethod?: string;
}

export class DonationService {
    // Créer un nouveau don 
    static async createDonation(data: DonationData) {
        try {
            const donation = await prisma.donation.create({
                data: {
                    ...data,
                    status: 'pending'
                },
                include: {
                    user: true 
                }
            }); 
            return { success: true, data: donation }; 
        } catch (error) {
            console.error('Erreur lors de la création du don:', error); 
            return { success: false, error: 'Erreur lors de la création du don'};
        }
    }

    // Récupérer tous les dons 
    static async getAllDonations() {
        try {
            const donations = await prisma.donation.findMany({
                include: {
                    user: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }); 
            return { success: true, data: donations }; 
        } catch (error) {
            console.error('Erreur lors de la récupération des dons:', error);
            return { success: false, error: 'Erreur lors de la récupération des dons' }; 
        }
    }

    // Récupérer un don par ID 
    static async getDonationById(id: number) {
        try {
            const donation = await prisma.donation.findUnique({
                where: { id },
                include: {
                    user: true 
                }
            });

            if (!donation) {
                return { success: false, error: 'Don non trouvé' };
            }

            return { success: true, data: donation }; 
    } catch (error) {
        console.error('Erreur lors de la récupération du don', error); 
        return { success: false, error: 'Erreur lors de la récupération du don' }; 
    }
}

// Récupérer les dons d'un utilisateur 
static async getDonationsByUser(userid: number) {
    try {
        const donations = await prisma.donation.findMany({
            where: { userid },
            orderBy: {
                createdAt: 'desc' 
            }
        });
        return { success: true, data: donations }; 
    } catch (error) {
        console.error('Erreur lors de la récupération des dons utilisateur:', error); 
        return { success: false, error: 'Erreur lors de la récupération des dons'}; 
    }
}

// Mettre à jour un donc (statut, paiement)
static async updateDonation(id: number, data: DonationUpdateData) {
    try {
        const donation = await prisma.donation.update({
            where: { id },
            data,
            include: {
                user: true
            }
        }); 
        return { success: true, data: donation }; 
    } catch (error) {
        console.error('Erreur lors de la mise à jour du don:', error);
        return { success: false, error: 'Erreur lors de la mise à jour du don' }; 
    }
}

// Supprimer un don 
static async deleteDonation(id: number) {
    try {
        await prisma.donation.delete({
            where: { id }
        }); 
        return { success: true, message: 'Don supprimé avec succès' }; 
    } catch (error) {
        console.error('Erreur lors de la suppression du don:', error);
        return { success: false, error: 'Erreur lors de la suppression du don' }; 
    }
}

// Statistiques des donc 
static async getDonationStats() {
try {
    const [totalAmount, totalCount, completeDonations] = await Promise.all([
        prisma.donation.aggregate({
            where: { status: 'completed' },
            _sum: { amount: true }
        }), 
        prisma.donation.count(),
        prisma.donation.count({
            where: { status: 'completed' }
        })
    ]);

    return {
        succes: true,
        data: {
            totalAmount: totalAmount._sum.amount || 0,
            totalDonations: totalCount,
            completeDonations,
            pendingDonations: totalCount - completeDonations
        }
    }; 
} catch (error) {
    console.error('Erreur lors du calcul des statistiques:', error); 
    return { success: false, error: 'Erreur lors du calcul des statistiques' }; 
}
}
} 