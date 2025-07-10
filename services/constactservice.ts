import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ContactData {
  userid?: number;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  priority?: string;
}

export interface ContactUpdateData {
  status?: string;
  priority?: string;
  repliedAt?: Date;
}

export class ContactService {
  // Créer un nouveau message de contact
  static async createContact(data: ContactData) {
    try {
      const contact = await prisma.contact.create({
        data: {
          ...data,
          status: 'new'
        },
        include: {
          user: {
            select: {
              id: true,
              firstname: true,
              lastname: true,
              email: true
            }
          }
        }
      });
      return { success: true, data: contact };
    } catch (error) {
      console.error('Erreur lors de la création du message:', error);
      return { success: false, error: 'Erreur lors de la création du message' };
    }
  }

  // Récupérer tous les messages (admin)
  static async getAllContacts() {
    try {
      const contacts = await prisma.contact.findMany({
        include: {
          user: {
            select: {
              id: true,
              firstname: true,
              lastname: true,
              email: true
            }
          }
        },
        orderBy: [
          { status: 'asc' }, // new en premier
          { createdAt: 'desc' }
        ]
      });
      return { success: true, data: contacts };
    } catch (error) {
      console.error('Erreur lors de la récupération des messages:', error);
      return { success: false, error: 'Erreur lors de la récupération des messages' };
    }
  }

  // Récupérer un message par ID
  static async getContactById(id: number) {
    try {
      const contact = await prisma.contact.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              firstname: true,
              lastname: true,
              email: true
            }
          }
        }
      });

      if (!contact) {
        return { success: false, error: 'Message non trouvé' };
      }

      return { success: true, data: contact };
    } catch (error) {
      console.error('Erreur lors de la récupération du message:', error);
      return { success: false, error: 'Erreur lors de la récupération du message' };
    }
  }

  // Récupérer les messages d'un utilisateur
  static async getContactsByUser(userid: number) {
    try {
      const contacts = await prisma.contact.findMany({
        where: { userid },
        orderBy: {
          createdAt: 'desc'
        }
      });
      return { success: true, data: contacts };
    } catch (error) {
      console.error('Erreur lors de la récupération des messages utilisateur:', error);
      return { success: false, error: 'Erreur lors de la récupération des messages' };
    }
  }

  // Mettre à jour un message (statut, priorité)
  static async updateContact(id: number, data: ContactUpdateData) {
    try {
      const contact = await prisma.contact.update({
        where: { id },
        data,
        include: {
          user: {
            select: {
              id: true,
              firstname: true,
              lastname: true,
              email: true
            }
          }
        }
      });
      return { success: true, data: contact };
    } catch (error) {
      console.error('Erreur lors de la mise à jour du message:', error);
      return { success: false, error: 'Erreur lors de la mise à jour du message' };
    }
  }

  // Marquer comme lu
  static async markAsRead(id: number) {
    try {
      const contact = await prisma.contact.update({
        where: { id },
        data: { status: 'read' },
        include: {
          user: {
            select: {
              id: true,
              firstname: true,
              lastname: true,
              email: true
            }
          }
        }
      });
      return { success: true, data: contact };
    } catch (error) {
      console.error('Erreur lors du marquage comme lu:', error);
      return { success: false, error: 'Erreur lors du marquage comme lu' };
    }
  }

  // Marquer comme répondu
  static async markAsReplied(id: number) {
    try {
      const contact = await prisma.contact.update({
        where: { id },
        data: { 
          status: 'replied',
          repliedAt: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              firstname: true,
              lastname: true,
              email: true
            }
          }
        }
      });
      return { success: true, data: contact };
    } catch (error) {
      console.error('Erreur lors du marquage comme répondu:', error);
      return { success: false, error: 'Erreur lors du marquage comme répondu' };
    }
  }

  // Supprimer un message
  static async deleteContact(id: number) {
    try {
      await prisma.contact.delete({
        where: { id }
      });
      return { success: true, message: 'Message supprimé avec succès' };
    } catch (error) {
      console.error('Erreur lors de la suppression du message:', error);
      return { success: false, error: 'Erreur lors de la suppression du message' };
    }
  }

  // Statistiques des messages
  static async getContactStats() {
    try {
      const [totalCount, newMessages, readMessages, repliedMessages] = await Promise.all([
        prisma.contact.count(),
        prisma.contact.count({
          where: { status: 'new' }
        }),
        prisma.contact.count({
          where: { status: 'read' }
        }),
        prisma.contact.count({
          where: { status: 'replied' }
        })
      ]);

      // Messages par priorité
      const [lowPriority, normalPriority, highPriority, urgentPriority] = await Promise.all([
        prisma.contact.count({ where: { priority: 'low' } }),
        prisma.contact.count({ where: { priority: 'normal' } }),
        prisma.contact.count({ where: { priority: 'high' } }),
        prisma.contact.count({ where: { priority: 'urgent' } })
      ]);

      return {
        success: true,
        data: {
          totalMessages: totalCount,
          newMessages,
          readMessages,
          repliedMessages,
          closedMessages: totalCount - newMessages - readMessages - repliedMessages,
          priorityStats: {
            low: lowPriority,
            normal: normalPriority,
            high: highPriority,
            urgent: urgentPriority
          }
        }
      };
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      return { success: false, error: 'Erreur lors du calcul des statistiques' };
    }
  }

  // Filtrer les messages par statut
  static async getContactsByStatus(status: string) {
    try {
      const contacts = await prisma.contact.findMany({
        where: { status },
        include: {
          user: {
            select: {
              id: true,
              firstname: true,
              lastname: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      return { success: true, data: contacts };
    } catch (error) {
      console.error('Erreur lors de la récupération par statut:', error);
      return { success: false, error: 'Erreur lors de la récupération des messages' };
    }
  }

  // Filtrer les messages par priorité
  static async getContactsByPriority(priority: string) {
    try {
      const contacts = await prisma.contact.findMany({
        where: { priority },
        include: {
          user: {
            select: {
              id: true,
              firstname: true,
              lastname: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      return { success: true, data: contacts };
    } catch (error) {
      console.error('Erreur lors de la récupération par priorité:', error);
      return { success: false, error: 'Erreur lors de la récupération des messages' };
    }
  }
}