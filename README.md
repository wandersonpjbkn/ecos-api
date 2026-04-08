# ecos-api

API REST para o catálogo do Clube Ecos Literários.
Node.js + Express + TypeScript + MongoDB + Supabase Auth.

## Estrutura

```
src/
├── config/
│   └── db.ts               # Conexão MongoDB
├── constants/
│   └── index.ts            # Roles, resources, actions, permissões padrão
├── middleware/
│   ├── authenticate.ts     # Valida JWT do Supabase, injeta req.user
│   ├── authorize.ts        # Verifica permissões no banco (RBAC)
│   └── validate.ts         # Validação de inputs por rota
├── models/
│   ├── Book.ts
│   ├── Permission.ts
│   ├── Subgenero.ts
│   └── User.ts
├── routes/
│   ├── auth.ts             # POST /auth/verify
│   ├── books.ts            # CRUD /books
│   ├── permissions.ts      # GET/PUT /permissions (admin)
│   ├── subgeneros.ts       # CRUD /subgeneros
│   └── users.ts            # GET/PATCH /users
├── types/
│   └── index.ts            # Interfaces compartilhadas
├── utils/
│   └── seed.ts             # Seed das permissões padrão
└── server.ts               # Entry point
```

## Setup

```bash
cp .env.example .env
# preencher MONGODB_URI, SUPABASE_JWT_SECRET e CORS_ORIGIN
yarn install
yarn dev
```

## Variáveis de ambiente

| Variável              | Obrigatória | Descrição |
|-----------------------|-------------|-----------|
| `MONGODB_URI`         | ✅ sempre   | Connection string do MongoDB Atlas |
| `SUPABASE_JWT_SECRET` | ✅ sempre   | Project Settings → API → JWT Secret |
| `CORS_ORIGIN`         | ✅ produção | Origins permitidas, separadas por vírgula |
| `API_PORT`            | não         | Porta do servidor (default: 3000) |
| `API_LOCALHOST`       | não         | Host de bind em dev (ex: 127.0.0.1) |

## Endpoints

### Auth
| Método | Rota           | Descrição |
|--------|----------------|-----------|
| POST   | /auth/verify   | Valida JWT do Supabase, cria usuário se novo |

### Books
| Método | Rota           | Permissão mínima |
|--------|----------------|------------------|
| GET    | /books         | viewer           |
| GET    | /books/:id     | viewer           |
| POST   | /books         | editor           |
| PATCH  | /books/:id     | editor (próprio) |
| DELETE | /books/:id     | admin            |

### Users
| Método | Rota               | Permissão mínima |
|--------|--------------------|------------------|
| GET    | /users             | editor           |
| GET    | /users/me          | qualquer         |
| PATCH  | /users/me          | qualquer         |
| PATCH  | /users/:id/role    | admin            |

### Subgêneros
| Método | Rota               | Permissão mínima |
|--------|--------------------|------------------|
| GET    | /subgeneros        | viewer           |
| POST   | /subgeneros        | admin            |
| DELETE | /subgeneros/:id    | admin            |

### Permissões
| Método | Rota                        | Permissão mínima |
|--------|-----------------------------|------------------|
| GET    | /permissions                | admin            |
| PUT    | /permissions/:role/:resource| admin            |

## Scripts

| Comando      | Descrição |
|--------------|-----------|
| `yarn dev`   | Servidor em modo watch |
| `yarn build` | Compila TypeScript → dist/ |
| `yarn start` | Roda o build compilado |
| `yarn lint`  | ESLint com auto-fix |
| `yarn ts`    | Checagem de tipos sem emitir |

## Roles padrão

| Role   | books          | users  | subgeneros     | permissions |
|--------|----------------|--------|----------------|-------------|
| admin  | CRUD           | CRUD   | CRUD           | CRUD        |
| editor | CRU (próprio)  | R      | R              | —           |
| viewer | R              | —      | R              | —           |

As permissões são configuráveis pelo admin via `PUT /permissions/:role/:resource`.
