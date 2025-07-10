import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export interface AdminUserData {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  phone: string | null;
  role: string;
  createdAt: Date;
  // Statistiques calculées
  totalAdoptions: number;
  totalDonations: number;
  pendingAdoptions: number;
  approvedAdoptions: number;
  totalDonationAmount: number;
}

export interface CreateUserData {
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  role: string;
  password?: string; // Optionnel, généré automatiquement si non fourni
}

export interface UpdateUserData {
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  role?: string;
}

export class AdminUserService {
  // Récupérer tous les utilisateurs avec leurs statistiques
  static async getAllUsers(): Promise<{ success: boolean; data?: AdminUserData[]; error?: string }> {
    try {
      console.log('🔥 AdminUserService.getAllUsers appelé');

      // Récupérer tous les utilisateurs
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          // Relations pour calculer les stats
          adopt: {
            select: {
              id: true,
              status: true,
            }
          },
          donations: {
            where: { status: 'completed' },
            select: {
              amount: true,
            }
          }
        }
      });

      // Calculer les statistiques pour chaque utilisateur
      const usersWithStats: AdminUserData[] = users.map(user => {
        const totalAdoptions = user.adopt.length;
        const pendingAdoptions = user.adopt.filter(a => a.status === 'pending').length;
        const approvedAdoptions = user.adopt.filter(a => a.status === 'approved').length;
        const totalDonations = user.donations.length;
        const totalDonationAmount = user.donations.reduce((sum, donation) => sum + Number(donation.amount), 0);

        return {
          id: user.id,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          phone: user.phone,
          role: user.role || 'user',
          createdAt: user.createdAt!,
          totalAdoptions,
          pendingAdoptions,
          approvedAdoptions,
          totalDonations,
          totalDonationAmount
        };
      });

      console.log(`✅ ${usersWithStats.length} utilisateurs récupérés avec leurs statistiques`);

      return { success: true, data: usersWithStats };
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des utilisateurs:', error);
      return { success: false, error: 'Erreur lors de la récupération des utilisateurs' };
    }
  }

  // Récupérer un utilisateur par ID avec ses détails complets
  static async getUserById(userId: number): Promise<{ success: boolean; data?: AdminUserData; error?: string }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          adopt: {
            include: {
              animal: { select: { name: true, type: true } }
            }
          },
          donations: { where: { status: 'completed' } },
          contacts: true
        }
      });

      if (!user) {
        return { success: false, error: 'Utilisateur non trouvé' };
      }

      const userWithStats: AdminUserData = {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        phone: user.phone,
        role: user.role || 'user',
        createdAt: user.createdAt!,
        totalAdoptions: user.adopt.length,
        pendingAdoptions: user.adopt.filter(a => a.status === 'pending').length,
        approvedAdoptions: user.adopt.filter(a => a.status === 'approved').length,
        totalDonations: user.donations.length,
        totalDonationAmount: user.donations.reduce((sum, d) => sum + Number(d.amount), 0)
      };

      return { success: true, data: userWithStats };
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error);
      return { success: false, error: 'Erreur lors de la récupération de l\'utilisateur' };
    }
  }

  // Créer un nouvel utilisateur
  static async createUser(userData: CreateUserData): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('🔥 AdminUserService.createUser appelé avec:', userData);

      // Vérifier si l'email existe déjà
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (existingUser) {
        return { success: false, error: 'Un utilisateur avec cet email existe déjà' };
      }

      // Générer un mot de passe par défaut si non fourni
      const defaultPassword = userData.password || 'TempPassword123!';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      // Créer l'utilisateur
      const newUser = await prisma.user.create({
        data: {
          firstname: userData.firstname,
          lastname: userData.lastname,
          email: userData.email,
          phone: userData.phone || null,
          role: userData.role,
          password: hashedPassword
        },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true
        }
      });

      console.log('✅ Utilisateur créé avec succès:', newUser.id);

      return { 
        success: true, 
        data: {
          ...newUser,
          temporaryPassword: userData.password ? undefined : defaultPassword // Retourner le mot de passe temporaire seulement si généré
        }
      };
    } catch (error) {
      console.error('❌ Erreur lors de la création de l\'utilisateur:', error);
      return { success: false, error: 'Erreur lors de la création de l\'utilisateur' };
    }
  }

  // Modifier un utilisateur
  static async updateUser(userId: number, updateData: UpdateUserData): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('🔥 AdminUserService.updateUser appelé pour userId:', userId);

      // Vérifier si l'utilisateur existe
      const existingUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!existingUser) {
        return { success: false, error: 'Utilisateur non trouvé' };
      }

      // Si on change l'email, vérifier qu'il n'existe pas déjà
      if (updateData.email && updateData.email !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email: updateData.email }
        });

        if (emailExists) {
          return { success: false, error: 'Un utilisateur avec cet email existe déjà' };
        }
      }

      // Mettre à jour l'utilisateur
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...updateData,
          phone: updateData.phone || null
        },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true
        }
      });

      console.log('✅ Utilisateur modifié avec succès:', userId);

      return { success: true, data: updatedUser };
    } catch (error) {
      console.error('❌ Erreur lors de la modification de l\'utilisateur:', error);
      return { success: false, error: 'Erreur lors de la modification de l\'utilisateur' };
    }
  }

  // Supprimer un utilisateur
  static async deleteUser(userId: number): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔥 AdminUserService.deleteUser appelé pour userId:', userId);

      // Vérifier si l'utilisateur existe
      const existingUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!existingUser) {
        return { success: false, error: 'Utilisateur non trouvé' };
      }

      // Supprimer l'utilisateur (les relations seront supprimées en cascade)
      await prisma.user.delete({
        where: { id: userId }
      });

      console.log('✅ Utilisateur supprimé avec succès:', userId);

      return { success: true };
    } catch (error) {
      console.error('❌ Erreur lors de la suppression de l\'utilisateur:', error);
      return { success: false, error: 'Erreur lors de la suppression de l\'utilisateur' };
    }
  }

  // Changer le rôle d'un utilisateur
  static async changeUserRole(userId: number, newRole: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('🔥 AdminUserService.changeUserRole appelé pour userId:', userId, 'nouveau rôle:', newRole);

      // Valider le rôle
      if (!['user', 'admin'].includes(newRole)) {
        return { success: false, error: 'Rôle invalide. Doit être "user" ou "admin"' };
      }

      // Vérifier si l'utilisateur existe
      const existingUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!existingUser) {
        return { success: false, error: 'Utilisateur non trouvé' };
      }

      // Mettre à jour le rôle
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: newRole },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
          role: true
        }
      });

      console.log('✅ Rôle utilisateur modifié avec succès:', userId, '→', newRole);

      return { success: true, data: updatedUser };
    } catch (error) {
      console.error('❌ Erreur lors du changement de rôle:', error);
      return { success: false, error: 'Erreur lors du changement de rôle' };
    }
  }

  // Statistiques rapides des utilisateurs
  static async getUserStats(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const [
        totalUsers,
        totalAdmins,
        totalRegularUsers,
        recentUsers,
        activeUsers
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: 'admin' } }),
        prisma.user.count({ where: { role: 'user' } }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setDate(new Date().getDate() - 30))
            }
          }
        }),
        prisma.user.count({
          where: {
            OR: [
              { adopt: { some: {} } },
              { donations: { some: {} } }
            ]
          }
        })
      ]);

      return {
        success: true,
        data: {
          totalUsers,
          totalAdmins,
          totalRegularUsers,
          recentUsers, // Inscrits dans les 30 derniers jours
          activeUsers  // Utilisateurs ayant fait au moins une action
        }
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques utilisateurs:', error);
      return { success: false, error: 'Erreur lors de la récupération des statistiques' };
    }
  }
}