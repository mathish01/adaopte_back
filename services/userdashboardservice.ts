import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface UserDashboardData {
  user: {
    totalAdoptions: number;
    pendingAdoptions: number;
    totalDonated: number;
  };
  recentAdoptions: Array<{
    id: number;
    status: string;
    createdAt: string;
    animal: {
      name: string;
      type: string;
      breed: string;
    };
  }>;
  recentDonations: Array<{
    id: number;
    amount: number;
    createdAt: string;
    status: string;
  }>;
  availableAnimals: Array<{
    id: number;
    name: string;
    type: string;
    breed: string;
    age: number;
    city: string;
  }>;
  donations: {
    totalAmount: number;
    totalCount: number;
    monthlyDonations: {
      month: string;
      amount: number;
      count: number;
    }[];
    recentDonations: {
      id: number;
      amount: number;
      message?: string | null;
      createdAt: Date;
      status: string;
    }[];
  };
  adoptions: {
    totalCount: number;
    animals: {
      id: number;
      animalId: number;
      animalName: string;
      animalType: string;
      animalBreed: string;
      animalAge: number;
      animalCity: string;
      animalDescription?: string | null;
      adoptionStatus: string;
      adoptionDate: Date;
      firstname: string;
      lastname: string;
      phone: string;
    }[];
  };
  summary: {
    totalDonations: number;
    totalAnimalsAdopted: number;
    pendingAdoptions: number;
    memberSince: Date;
  };
}

export class UserDashboardService {
  // Récupérer toutes les données du dashboard utilisateur
  static async getUserDashboard(userId: number): Promise<{ success: boolean; data?: UserDashboardData; error?: string }> {
    try {
      console.log('🔥 UserDashboardService.getUserDashboard appelé pour userId:', userId);

      // Récupérer les informations de l'utilisateur
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true }
      });

      if (!user) {
        return { success: false, error: 'Utilisateur non trouvé' };
      }

      // Calculer le début de l'année en cours
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1);
      const endOfYear = new Date(currentYear + 1, 0, 1);

      // 1. RÉCUPÉRER LES DONS DE L'ANNÉE
      const donations = await prisma.donation.findMany({
        where: {
          userid: userId,
          createdAt: {
            gte: startOfYear,
            lt: endOfYear
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Calculer le total des dons
      const totalDonationAmount = donations
        .filter(d => d.status === 'completed')
        .reduce((sum, donation) => sum + Number(donation.amount), 0);

      // Grouper les dons par mois
      const monthlyDonations = Array.from({ length: 12 }, (_, i) => {
        const month = new Date(currentYear, i, 1);
        const monthName = month.toLocaleDateString('fr-FR', { month: 'long' });
        
        const monthDonations = donations.filter(d => {
          const donationDate = new Date(d.createdAt!);
          return donationDate.getMonth() === i && d.status === 'completed';
        });

        return {
          month: monthName,
          amount: monthDonations.reduce((sum, d) => sum + Number(d.amount), 0),
          count: monthDonations.length
        };
      });

      // Dons récents (5 derniers)
      const recentDonationsDetailed = donations.slice(0, 5).map(d => ({
        id: d.id,
        amount: Number(d.amount),
        message: d.message,
        createdAt: d.createdAt!,
        status: d.status
      }));

      // 2. RÉCUPÉRER LES ADOPTIONS
      const adoptions = await prisma.adopt.findMany({
        where: { userid: userId },
        include: {
          animal: {
            select: {
              id: true,
              name: true,
              type: true,
              breed: true,
              age: true,
              city: true,
              description: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      console.log('🔥 Adoptions trouvées:', adoptions.length);

      // Formatter les données d'adoption pour l'interface complète
      const adoptionAnimals = adoptions.map(adoption => ({
        id: adoption.id,
        animalId: adoption.animal.id,
        animalName: adoption.animal.name,
        animalType: adoption.animal.type,
        animalBreed: adoption.animal.breed,
        animalAge: adoption.animal.age,
        animalCity: adoption.animal.city,
        animalDescription: adoption.animal.description,
        adoptionStatus: adoption.status,
        adoptionDate: adoption.createdAt!,
        firstname: adoption.firstname,
        lastname: adoption.lastname,
        phone: adoption.phone
      }));

      // Formatter les adoptions récentes pour l'affichage dashboard
      const recentAdoptions = adoptions.slice(0, 3).map(adoption => ({
        id: adoption.id,
        status: adoption.status,
        createdAt: adoption.createdAt!.toISOString(),
        animal: {
          name: adoption.animal.name,
          type: adoption.animal.type,
          breed: adoption.animal.breed
        }
      }));

      // Dons récents pour l'affichage dashboard (format simplifié)
      const recentDonations = donations.slice(0, 3).map(donation => ({
        id: donation.id,
        amount: Number(donation.amount),
        createdAt: donation.createdAt!.toISOString(),
        status: donation.status
      }));

      // 3. RÉCUPÉRER LES ANIMAUX DISPONIBLES 🔥
      console.log('🔥 Récupération des animaux disponibles...');
      const availableAnimals = await prisma.animal.findMany({
        where: { status: 'available' },
        select: {
          id: true,
          name: true,
          type: true,
          breed: true,
          age: true,
          city: true
        },
        take: 6, // Limiter à 6 pour le dashboard
        orderBy: { createdAt: 'desc' }
      });

      console.log('🔥 Animaux disponibles trouvés:', availableAnimals.length);

      // 4. CALCULER LES STATISTIQUES
      const pendingAdoptions = adoptions.filter(a => a.status === 'pending').length;
      const approvedAdoptions = adoptions.filter(a => a.status === 'approved').length;

      // 5. CONSTRUIRE L'OBJET DE DONNÉES COMPLET
      const dashboardData: UserDashboardData = {
        // Données pour l'interface dashboard user
        user: {
          totalAdoptions: adoptions.length,
          pendingAdoptions: pendingAdoptions,
          totalDonated: totalDonationAmount
        },
        recentAdoptions: recentAdoptions,
        recentDonations: recentDonations,
        availableAnimals: availableAnimals, // 🔥 AJOUTÉ !
        
        // Données détaillées (pour compatibilité avec l'ancienne interface)
        donations: {
          totalAmount: totalDonationAmount,
          totalCount: donations.filter(d => d.status === 'completed').length,
          monthlyDonations,
          recentDonations: recentDonationsDetailed
        },
        adoptions: {
          totalCount: adoptions.length,
          animals: adoptionAnimals
        },
        summary: {
          totalDonations: totalDonationAmount,
          totalAnimalsAdopted: approvedAdoptions,
          pendingAdoptions,
          memberSince: user.createdAt!
        }
      };

      console.log('🔥 Dashboard data construit avec succès');

      return { success: true, data: dashboardData };
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du dashboard utilisateur:', error);
      return { success: false, error: 'Erreur lors de la récupération des données du dashboard' };
    }
  }

  // Récupérer seulement les dons de l'utilisateur pour l'année
  static async getUserDonations(userId: number, year?: number): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const targetYear = year || new Date().getFullYear();
      const startOfYear = new Date(targetYear, 0, 1);
      const endOfYear = new Date(targetYear + 1, 0, 1);

      const donations = await prisma.donation.findMany({
        where: {
          userid: userId,
          createdAt: {
            gte: startOfYear,
            lt: endOfYear
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const totalAmount = donations
        .filter(d => d.status === 'completed')
        .reduce((sum, donation) => sum + Number(donation.amount), 0);

      return {
        success: true,
        data: {
          donations,
          totalAmount,
          year: targetYear,
          count: donations.filter(d => d.status === 'completed').length
        }
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des dons:', error);
      return { success: false, error: 'Erreur lors de la récupération des dons' };
    }
  }

  // Récupérer seulement les adoptions de l'utilisateur
  static async getUserAdoptions(userId: number): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const adoptions = await prisma.adopt.findMany({
        where: { userid: userId },
        include: {
          animal: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return { success: true, data: adoptions };
    } catch (error) {
      console.error('Erreur lors de la récupération des adoptions:', error);
      return { success: false, error: 'Erreur lors de la récupération des adoptions' };
    }
  }

  // Statistiques rapides pour l'utilisateur
  static async getUserQuickStats(userId: number): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1);

      const [donationsCount, donationsSum, adoptionsCount, pendingAdoptions] = await Promise.all([
        prisma.donation.count({
          where: {
            userid: userId,
            status: 'completed',
            createdAt: { gte: startOfYear }
          }
        }),
        prisma.donation.aggregate({
          where: {
            userid: userId,
            status: 'completed',
            createdAt: { gte: startOfYear }
          },
          _sum: { amount: true }
        }),
        prisma.adopt.count({
          where: {
            userid: userId,
            status: 'approved'
          }
        }),
        prisma.adopt.count({
          where: {
            userid: userId,
            status: 'pending'
          }
        })
      ]);

      return {
        success: true,
        data: {
          donationsThisYear: donationsCount,
          totalDonatedThisYear: donationsSum._sum.amount || 0,
          totalAnimalsAdopted: adoptionsCount,
          pendingAdoptions
        }
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      return { success: false, error: 'Erreur lors de la récupération des statistiques' };
    }
  }
}