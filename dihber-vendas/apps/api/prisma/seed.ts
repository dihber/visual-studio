import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Gera um CNPJ válido a partir de uma base de 8 dígitos + filial 0001. */
function gerarCnpj(base: number): string {
  const d = (String(base).padStart(8, '0') + '0001').split('').map(Number);
  const dv = (nums: number[], pesos: number[]) => {
    const r = nums.reduce((s, n, i) => s + n * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  d.push(dv(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  d.push(dv(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  return d.join('');
}

const CLIENTES = [
  ['Mercado Bom Preço Ltda', 'Mercado Bom Preço', 'São Paulo', 'SP'],
  ['Padaria Pão Quente ME', 'Pão Quente', 'Campinas', 'SP'],
  ['Supermercado Família Ltda', 'Super Família', 'Belo Horizonte', 'MG'],
  ['Mercearia do Zé ME', 'Mercearia do Zé', 'Curitiba', 'PR'],
  ['Empório Central Ltda', 'Empório Central', 'Rio de Janeiro', 'RJ'],
  ['Atacadão Norte Ltda', 'Atacadão Norte', 'Goiânia', 'GO'],
  ['Minimercado Estrela ME', 'Estrela', 'Santos', 'SP'],
  ['Restaurante Sabor Caseiro Ltda', 'Sabor Caseiro', 'Ribeirão Preto', 'SP'],
  ['Lanchonete Ponto Certo ME', 'Ponto Certo', 'Uberlândia', 'MG'],
  ['Distribuidora Sul Ltda', 'Distribuidora Sul', 'Porto Alegre', 'RS'],
] as const;

const PRODUTOS: [string, string, number, number][] = [
  ['ARROZ TIPO 1 5KG', 'CX C/ 6 UN', 6, 27.9],
  ['FEIJÃO CARIOCA 1KG', 'CX C/ 10 UN', 10, 8.49],
  ['AÇÚCAR REFINADO 1KG', 'CX C/ 10 UN', 10, 4.99],
  ['CAFÉ TORRADO 500G', 'CX C/ 20 UN', 20, 17.9],
  ['ÓLEO DE SOJA 900ML', 'CX C/ 20 UN', 20, 7.29],
  ['MACARRÃO ESPAGUETE 500G', 'CX C/ 24 UN', 24, 4.59],
  ['FARINHA DE TRIGO 1KG', 'CX C/ 10 UN', 10, 5.39],
  ['SAL REFINADO 1KG', 'CX C/ 20 UN', 20, 2.49],
  ['LEITE INTEGRAL 1L', 'CX C/ 12 UN', 12, 5.19],
  ['MOLHO DE TOMATE 340G', 'CX C/ 24 UN', 24, 2.89],
  ['SABÃO EM PÓ 1KG', 'CX C/ 12 UN', 12, 13.9],
  ['DETERGENTE 500ML', 'CX C/ 24 UN', 24, 2.69],
  ['PAPEL HIGIÊNICO 12 ROLOS', 'FD C/ 4 PCT', 4, 21.9],
  ['REFRIGERANTE COLA 2L', 'FD C/ 6 UN', 6, 9.99],
  ['ÁGUA MINERAL 500ML', 'FD C/ 12 UN', 12, 1.79],
  ['BISCOITO RECHEADO 130G', 'CX C/ 40 UN', 40, 2.49],
  ['MARGARINA 500G', 'CX C/ 12 UN', 12, 8.99],
  ['ACHOCOLATADO 400G', 'CX C/ 24 UN', 24, 7.49],
  ['MILHO VERDE LATA 200G', 'CX C/ 24 UN', 24, 3.29],
  ['SARDINHA LATA 125G', 'CX C/ 50 UN', 50, 5.49],
];

async function main() {
  const hash = (s: string) => bcrypt.hash(s, 10);

  const supervisor = await prisma.supervisor.upsert({
    where: { codigo: 'S01' },
    update: {},
    create: {
      codigo: 'S01',
      nome: 'Carlos Supervisor',
      email: 'carlos@exemplo.com.br',
      telefone: '(11) 98888-0001',
    },
  });

  const vendedores = await Promise.all(
    [
      ['07', 'João Vendedor'],
      ['08', 'Maria Vendedora'],
    ].map(([codigo, nome]) =>
      prisma.vendedor.upsert({
        where: { codigo },
        update: {},
        create: { codigo, nome, supervisorId: supervisor.id, telefone: '(11) 97777-00' + codigo },
      }),
    ),
  );

  await prisma.usuario.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      nome: 'Administrador',
      login: 'admin',
      perfil: 'ADMIN',
      senhaHash: await hash('admin123'),
    },
  });
  await prisma.usuario.upsert({
    where: { login: 'supervisor' },
    update: {},
    create: {
      nome: supervisor.nome,
      login: 'supervisor',
      perfil: 'SUPERVISOR',
      supervisorId: supervisor.id,
      senhaHash: await hash('super123'),
    },
  });
  for (const [i, v] of vendedores.entries()) {
    await prisma.usuario.upsert({
      where: { login: `vendedor${i + 1}` },
      update: {},
      create: {
        nome: v.nome,
        login: `vendedor${i + 1}`,
        perfil: 'VENDEDOR',
        vendedorId: v.id,
        senhaHash: await hash('vend123'),
      },
    });
  }

  for (const [i, [razaoSocial, nomeFantasia, cidade, uf]] of CLIENTES.entries()) {
    const codigo = String(i + 1).padStart(5, '0');
    await prisma.cliente.upsert({
      where: { codigo },
      update: {},
      create: {
        codigo,
        razaoSocial,
        nomeFantasia,
        cpfCnpj: gerarCnpj(12345600 + i * 7),
        telefone: `(11) 3333-${String(1000 + i)}`,
        endereco: `Rua Exemplo, ${100 + i * 10}`,
        cidade,
        uf,
      },
    });
  }

  for (const [i, [descricao, embalagem, qtdPorCaixa, preco]] of PRODUTOS.entries()) {
    const codigo = String(100 + i * 7).padStart(5, '0');
    await prisma.produto.upsert({
      where: { codigo },
      update: {},
      create: {
        codigo,
        descricao,
        embalagem,
        qtdPorCaixa,
        precoUnitario: new Prisma.Decimal(preco),
        estoque: new Prisma.Decimal(500 + i * 25),
      },
    });
  }

  console.log(
    'Seed concluído. Usuários: admin/admin123 · supervisor/super123 · vendedor1/vend123 · vendedor2/vend123',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
