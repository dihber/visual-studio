import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

/**
 * Cria o primeiro administrador (login "admin") em um banco novo, usando a senha da variável
 * ADMIN_SENHA_INICIAL. Não faz nada se a variável estiver vazia ou se já existir qualquer ADMIN.
 */
export async function criarAdminInicial(log: { info(msg: string): void }) {
  const senha = process.env.ADMIN_SENHA_INICIAL?.trim();
  if (!senha) return;
  if (senha.length < 8) throw new Error('ADMIN_SENHA_INICIAL deve ter pelo menos 8 caracteres');
  const existe = await prisma.usuario.count({ where: { perfil: 'ADMIN' } });
  if (existe > 0) return;
  await prisma.usuario.create({
    data: {
      nome: 'Administrador',
      login: 'admin',
      perfil: 'ADMIN',
      senhaHash: await bcrypt.hash(senha, 10),
    },
  });
  log.info('Administrador inicial criado (login "admin"). Remova ADMIN_SENHA_INICIAL do ambiente.');
}
