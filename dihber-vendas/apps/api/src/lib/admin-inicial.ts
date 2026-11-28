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

/**
 * Recuperação de acesso: se ADMIN_REDEFINIR_SENHA estiver definida, ao iniciar a API a senha
 * do usuário "admin" é trocada por ela (o usuário é reativado e volta a ser ADMIN; as sessões
 * abertas são encerradas). Se não existir usuário "admin", ele é criado.
 * Depois de entrar, REMOVA a variável do ambiente — enquanto existir, cada reinício redefine a senha.
 */
export async function redefinirSenhaAdmin(log: {
  info(msg: string): void;
  warn(msg: string): void;
}) {
  const senha = process.env.ADMIN_REDEFINIR_SENHA?.trim();
  if (!senha) return;
  if (senha.length < 8) {
    // não derruba a API por causa disso: só avisa e ignora
    log.warn('ADMIN_REDEFINIR_SENHA ignorada: a senha deve ter pelo menos 8 caracteres.');
    return;
  }
  const senhaHash = await bcrypt.hash(senha, 10);
  const admin = await prisma.usuario.findFirst({
    where: { login: { equals: 'admin', mode: 'insensitive' } },
  });
  if (admin) {
    await prisma.usuario.update({
      where: { id: admin.id },
      data: { senhaHash, ativo: true, perfil: 'ADMIN', vendedorId: null, supervisorId: null },
    });
    await prisma.sessao.updateMany({
      where: { usuarioId: admin.id, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  } else {
    await prisma.usuario.create({
      data: { nome: 'Administrador', login: 'admin', perfil: 'ADMIN', senhaHash },
    });
  }
  log.warn(
    'Senha do usuário "admin" redefinida por ADMIN_REDEFINIR_SENHA. Remova essa variável do ambiente.',
  );
}
