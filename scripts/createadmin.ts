import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    // Configuration du compte admin
    const adminData = {
      firstname: 'Admin',
      lastname: 'Adaopte',
      email: 'admin@adaopte.com', // Modifie avec ton email
      password: 'AdminAdaopte2024!', // Modifie avec un mot de passe sécurisé
      role: 'admin'
    };

    // Vérifier si l'admin existe déjà
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminData.email }
    });

    if (existingAdmin) {
      console.log('❌ Un utilisateur avec cet email existe déjà');
      
      // Si c'est un user normal, le promouvoir en admin
      if (existingAdmin.role !== 'admin') {
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { role: 'admin' }
        });
        console.log('✅ Utilisateur promu administrateur !');
      } else {
        console.log('ℹ️ Cet utilisateur est déjà administrateur');
      }
      return;
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(adminData.password, 12);

    // Créer le compte admin
    const admin = await prisma.user.create({
      data: {
        firstname: adminData.firstname,
        lastname: adminData.lastname,
        email: adminData.email,
        password: hashedPassword,
        role: 'admin'
      }
    });

    console.log('🎉 Compte administrateur créé avec succès !');
    console.log(`📧 Email: ${admin.email}`);
    console.log(`🔑 Mot de passe: ${adminData.password}`);
    console.log(`👤 ID: ${admin.id}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Changez le mot de passe après la première connexion !');

  } catch (error) {
    console.error('❌ Erreur lors de la création du compte admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Fonction pour promouvoir un utilisateur existant
async function promoteUserToAdmin(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.log('❌ Utilisateur non trouvé');
      return;
    }

    if (user.role === 'admin') {
      console.log('ℹ️ Cet utilisateur est déjà administrateur');
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'admin' }
    });

    console.log('✅ Utilisateur promu administrateur !');
    console.log(`👤 ${user.firstname} ${user.lastname} (${user.email})`);

  } catch (error) {
    console.error('❌ Erreur lors de la promotion:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution du script
const args = process.argv.slice(2);

if (args[0] === 'promote' && args[1]) {
  // Usage: npm run create-admin promote email@example.com
  promoteUserToAdmin(args[1]);
} else {
  // Usage: npm run create-admin
  createAdmin();
}