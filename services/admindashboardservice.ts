import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AdminDashboardData {
  users: {
    totalCount: number;
    newThisMonth: number;
    newThisWeek: number;
    activeUsers: number;
  };
  animals: {
    totalCount: number;
    available: number;
    adopted: number;
    pending: number;
    newThisMonth: number;
    byType: {
      type: string;
      count: number;
    }[];
  };
  adoptions: {
    totalCount: number;
    pending: number;
    approved: number;
    rejected: number;
    thisMonth: number;
    thisWeek: number;
    recentAdoptions: {
      id: number;
      animalName: string;
      animalType: string;
      userName: string;
      status: string;
      createdAt: Date;
    }[];
  };
  donations: {
    totalAmount: number;
    totalCount: number;
    thisMonth: {
      amount: number;
      count: number;
    };
    thisWeek: {
      amount: number;
      count: number;
    };
    averageDonation: number;
    monthlyRevenue: {
      month: string;
      amount: number;
      count: number;
    }[];
    recentDonations: {
      id: number;
      amount: number;
      donorName: string;
      status: string;
      createdAt: Date;
    }[];
  };
  volunteers: {
    totalCount: number;
    pendingApplications: number;
    newThisMonth: number;
    byStatus: {
      status: string;
      count: number;
    }[];
  };
  contacts: {
    totalCount: number;
    unreadCount: number;
    newThisWeek: number;
    byPriority: {
      priority: string;
      count: number;
    }[];
    recentMessages: {
      id: number;
      senderName: string;
      subject: string;
      status: string;
      priority: string;
      createdAt: Date;
    }[];
  };
  activity: {
    dailyStats: {
      date: string;
      newUsers: number;
      newAdoptions: number;
      newDonations: number;
      donationAmount: number;
    }[];
  };
}

export class AdminDashboardService {
  // Récupérer toutes les données du dashboard admin
  static async getAdminDashboard(): Promise<{ success: boolean; data?: AdminDashboardData; error?: string }> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1);

      // 1. STATISTIQUES UTILISATEURS
      const [totalUsers, newUsersThisMonth, newUsersThisWeek] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: { createdAt: { gte: startOfMonth } }
        }),
        prisma.user.count({
          where: { createdAt: { gte: startOfWeek } }
        })
      ]);

      // Utilisateurs actifs (qui ont fait une action dans les 30 derniers jours)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const activeUsers = await prisma.user.count({
        where: {
          OR: [
            { adopt: { some: { createdAt: { gte: thirtyDaysAgo } } } },
            { donations: { some: { createdAt: { gte: thirtyDaysAgo } } } },
            { contacts: { some: { createdAt: { gte: thirtyDaysAgo } } } }
          ]
        }
      });

      // 2. STATISTIQUES ANIMAUX
      const [totalAnimals, availableAnimals, adoptedAnimals, newAnimalsThisMonth] = await Promise.all([
        prisma.animal.count(),
        prisma.animal.count({ where: { status: 'available' } }),
        prisma.animal.count({ where: { status: 'adopted' } }),
        prisma.animal.count({
          where: { createdAt: { gte: startOfMonth } }
        })
      ]);

      const pendingAnimals = await prisma.animal.count({ where: { status: 'pending' } });

      // Animaux par type
      const animalsByType = await prisma.animal.groupBy({
        by: ['type'],
        _count: { type: true }
      });

      // 3. STATISTIQUES ADOPTIONS
      const [totalAdoptions, pendingAdoptions, approvedAdoptions, rejectedAdoptions, adoptionsThisMonth, adoptionsThisWeek] = await Promise.all([
        prisma.adopt.count(),
        prisma.adopt.count({ where: { status: 'pending' } }),
        prisma.adopt.count({ where: { status: 'approved' } }),
        prisma.adopt.count({ where: { status: 'rejected' } }),
        prisma.adopt.count({
          where: { createdAt: { gte: startOfMonth } }
        }),
        prisma.adopt.count({
          where: { createdAt: { gte: startOfWeek } }
        })
      ]);

      // Adoptions récentes
      const recentAdoptions = await prisma.adopt.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          animal: { select: { name: true, type: true } },
          users: { select: { firstname: true, lastname: true } }
        }
      });

      // 4. STATISTIQUES DONS
      const [donationsStats, donationsThisMonth, donationsThisWeek] = await Promise.all([
        prisma.donation.aggregate({
          where: { status: 'completed' },
          _sum: { amount: true },
          _count: { id: true },
          _avg: { amount: true }
        }),
        prisma.donation.aggregate({
          where: {
            status: 'completed',
            createdAt: { gte: startOfMonth }
          },
          _sum: { amount: true },
          _count: { id: true }
        }),
        prisma.donation.aggregate({
          where: {
            status: 'completed',
            createdAt: { gte: startOfWeek }
          },
          _sum: { amount: true },
          _count: { id: true }
        })
      ]);

      // Revenus mensuels de l'année
      const monthlyRevenue = await Promise.all(
        Array.from({ length: 12 }, async (_, i) => {
          const monthStart = new Date(currentYear, i, 1);
          const monthEnd = new Date(currentYear, i + 1, 1);
          
          const monthData = await prisma.donation.aggregate({
            where: {
              status: 'completed',
              createdAt: {
                gte: monthStart,
                lt: monthEnd
              }
            },
            _sum: { amount: true },
            _count: { id: true }
          });

          return {
            month: monthStart.toLocaleDateString('fr-FR', { month: 'long' }),
            amount: Number(monthData._sum.amount || 0),
            count: monthData._count.id
          };
        })
      );

      // Dons récents
      const recentDonations = await prisma.donation.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstname: true, lastname: true } }
        }
      });

      // 5. STATISTIQUES BÉNÉVOLES
      const [totalVolunteers, pendingVolunteers, newVolunteersThisMonth] = await Promise.all([
        prisma.volunteer.count(),
        prisma.volunteer.count({ where: { status: 'pending' } }),
        prisma.volunteer.count({
          where: { createdAt: { gte: startOfMonth } }
        })
      ]);

      const volunteersByStatus = await prisma.volunteer.groupBy({
        by: ['status'],
        _count: { status: true }
      });

      // 6. STATISTIQUES MESSAGES
      const [totalContacts, unreadContacts, newContactsThisWeek] = await Promise.all([
        prisma.contact.count(),
        prisma.contact.count({ where: { status: 'new' } }),
        prisma.contact.count({
          where: { createdAt: { gte: startOfWeek } }
        })
      ]);

      const contactsByPriority = await prisma.contact.groupBy({
        by: ['priority'],
        _count: { priority: true }
      });

      // Messages récents
      const recentMessages = await prisma.contact.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true
        }
      });

      // 7. ACTIVITÉ QUOTIDIENNE (7 derniers jours)
      const dailyStats = await Promise.all(
        Array.from({ length: 7 }, async (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);

          const [newUsers, newAdoptions, donationData] = await Promise.all([
            prisma.user.count({
              where: {
                createdAt: { gte: dayStart, lt: dayEnd }
              }
            }),
            prisma.adopt.count({
              where: {
                createdAt: { gte: dayStart, lt: dayEnd }
              }
            }),
            prisma.donation.aggregate({
              where: {
                status: 'completed',
                createdAt: { gte: dayStart, lt: dayEnd }
              },
              _count: { id: true },
              _sum: { amount: true }
            })
          ]);

          return {
            date: dayStart.toISOString().split('T')[0],
            newUsers,
            newAdoptions,
            newDonations: donationData._count.id,
            donationAmount: Number(donationData._sum.amount || 0)
          };
        })
      );

      // Construire la réponse
      const dashboardData: AdminDashboardData = {
        users: {
          totalCount: totalUsers,
          newThisMonth: newUsersThisMonth,
          newThisWeek: newUsersThisWeek,
          activeUsers
        },
        animals: {
          totalCount: totalAnimals,
          available: availableAnimals,
          adopted: adoptedAnimals,
          pending: pendingAnimals,
          newThisMonth: newAnimalsThisMonth,
          byType: animalsByType.map(item => ({
            type: item.type,
            count: item._count.type
          }))
        },
        adoptions: {
          totalCount: totalAdoptions,
          pending: pendingAdoptions,
          approved: approvedAdoptions,
          rejected: rejectedAdoptions,
          thisMonth: adoptionsThisMonth,
          thisWeek: adoptionsThisWeek,
          recentAdoptions: recentAdoptions.map(adoption => ({
            id: adoption.id,
            animalName: adoption.animal.name,
            animalType: adoption.animal.type,
            userName: `${adoption.users.firstname} ${adoption.users.lastname}`,
            status: adoption.status,
            createdAt: adoption.createdAt!
          }))
        },
        donations: {
          totalAmount: Number(donationsStats._sum.amount || 0),
          totalCount: donationsStats._count.id,
          thisMonth: {
            amount: Number(donationsThisMonth._sum.amount || 0),
            count: donationsThisMonth._count.id
          },
          thisWeek: {
            amount: Number(donationsThisWeek._sum.amount || 0),
            count: donationsThisWeek._count.id
          },
          averageDonation: Number(donationsStats._avg.amount || 0),
          monthlyRevenue,
          recentDonations: recentDonations.map(donation => ({
            id: donation.id,
            amount: Number(donation.amount),
            donorName: donation.user 
              ? `${donation.user.firstname} ${donation.user.lastname}`
              : `${donation.firstname} ${donation.lastname}`,
            status: donation.status,
            createdAt: donation.createdAt!
          }))
        },
        volunteers: {
          totalCount: totalVolunteers,
          pendingApplications: pendingVolunteers,
          newThisMonth: newVolunteersThisMonth,
          byStatus: volunteersByStatus.map(item => ({
            status: item.status,
            count: item._count.status
          }))
        },
        contacts: {
          totalCount: totalContacts,
          unreadCount: unreadContacts,
          newThisWeek: newContactsThisWeek,
          byPriority: contactsByPriority.map(item => ({
            priority: item.priority,
            count: item._count.priority
          })),
          recentMessages: recentMessages.map(message => ({
            id: message.id,
            senderName: `${message.firstname} ${message.lastname}`,
            subject: message.subject,
            status: message.status,
            priority: message.priority,
            createdAt: message.createdAt!
          }))
        },
        activity: {
          dailyStats: dailyStats.reverse() // Ordre chronologique
        }
      };

      return { success: true, data: dashboardData };
    } catch (error) {
      console.error('Erreur lors de la récupération du dashboard admin:', error);
      return { success: false, error: 'Erreur lors de la récupération des données du dashboard admin' };
    }
  }

  // Statistiques rapides pour widgets admin
  static async getAdminQuickStats(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const [
        totalUsers,
        totalAnimals,
        pendingAdoptions,
        unreadMessages,
        totalDonations,
        pendingVolunteers
      ] = await Promise.all([
        prisma.user.count(),
        prisma.animal.count({ where: { status: 'available' } }),
        prisma.adopt.count({ where: { status: 'pending' } }),
        prisma.contact.count({ where: { status: 'new' } }),
        prisma.donation.aggregate({
          where: { status: 'completed' },
          _sum: { amount: true }
        }),
        prisma.volunteer.count({ where: { status: 'pending' } })
      ]);

      return {
        success: true,
        data: {
          totalUsers,
          availableAnimals: totalAnimals,
          pendingAdoptions,
          unreadMessages,
          totalDonationAmount: Number(totalDonations._sum.amount || 0),
          pendingVolunteers
        }
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques rapides:', error);
      return { success: false, error: 'Erreur lors de la récupération des statistiques' };
    }
  }
}