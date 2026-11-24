import {
  Cog,
  CircleDot,
  Disc3,
  HardHat,
  Link2,
  MoveVertical,
  Paintbrush,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * The nine APEX sectors. This is brand identity, not catalog data: which products live in a sector is
 * decided in the database. A sector's `key` is the slug of the category that holds its products, so
 * the owner creates/edits those categories in the admin panel (see docs/apex-sectors.sql).
 */
export type Sector = {
  key: string;
  code: string;
  name: string;
  description: string;
  /** Mono tag line with the typical contents of the sector, as a quick technical read. */
  scope: string;
  icon: LucideIcon;
};

export const SECTORS: readonly Sector[] = [
  {
    key: "engine-power",
    code: "01",
    name: "Engine & Power",
    description: "O coração da moto: o que gera e entrega potência.",
    scope: "Pistões · Cilindros · Cabeçotes",
    icon: Cog,
  },
  {
    key: "braking-system",
    code: "02",
    name: "Braking System",
    description: "Frenagem confiável, do disco à pastilha.",
    scope: "Discos · Pastilhas · Cilindros mestres",
    icon: Disc3,
  },
  {
    key: "suspension-control",
    code: "03",
    name: "Suspension & Control",
    description: "Estabilidade e precisão em cada curva.",
    scope: "Amortecedores · Garfos · Manetes",
    icon: MoveVertical,
  },
  {
    key: "wheels-tires",
    code: "04",
    name: "Wheels & Tires",
    description: "O único contato com o asfalto.",
    scope: "Rodas · Pneus · Rolamentos",
    icon: CircleDot,
  },
  {
    key: "transmission",
    code: "05",
    name: "Transmission",
    description: "Embreagem e transmissão para transferir a força.",
    scope: "Kit relação · Embreagem · Câmbio",
    icon: Link2,
  },
  {
    key: "exhaust-performance",
    code: "06",
    name: "Exhaust & Performance",
    description: "Escapamentos e itens para extrair mais da moto.",
    scope: "Escapamentos · Filtros · Admissão",
    icon: Wind,
  },
  {
    key: "design-accessories",
    code: "07",
    name: "Design & Accessories",
    description: "Carenagens, retrovisores e acabamento.",
    scope: "Carenagens · Retrovisores · Acessórios",
    icon: Paintbrush,
  },
  {
    key: "helmets-protection",
    code: "08",
    name: "Helmets & Protection",
    description: "Segurança de quem pilota.",
    scope: "Capacetes · Proteção · Vestuário",
    icon: HardHat,
  },
  {
    key: "electrical-system",
    code: "09",
    name: "Electrical System",
    description: "Iluminação e sistema elétrico.",
    scope: "Faróis · Baterias · Chicotes",
    icon: Zap,
  },
];

export const sectorByKey = (key?: string | null) => SECTORS.find((s) => s.key === key);
