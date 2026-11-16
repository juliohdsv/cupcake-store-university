import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..");
const migrations = resolve(root, "Model/db/migrations");
const database = new Database(":memory:");
database.exec("CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
for (const name of readdirSync(migrations).filter((file) => file.endsWith(".sql")).sort()) {
  database.exec(readFileSync(resolve(migrations, name), "utf8"));
}

const tables = new Map();
for (const { name } of database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()) {
  const columns = database.pragma(`table_info(${name})`);
  const foreignKeys = new Set(database.pragma(`foreign_key_list(${name})`).map((key) => key.from));
  const unique = new Set();
  for (const index of database.pragma(`index_list(${name})`).filter((entry) => entry.unique)) {
    const indexed = database.pragma(`index_info(${index.name})`);
    if (indexed.length === 1) unique.add(indexed[0].name);
  }
  tables.set(name, columns.map((column) => ({
    name: column.name,
    type: column.type,
    key: column.pk ? "PK" : foreignKeys.has(column.name) ? "FK" : unique.has(column.name) ? "UQ" : "",
    optional: !column.notnull && !column.pk,
  })));
}
database.close();

const positions = {
  site_reviews: { x: 90, y: 190, width: 580, title: "Avaliações do site" },
  schema_migrations: { x: 90, y: 740, width: 580, title: "Controle de migrações" },
  orders: { x: 770, y: 190, width: 600, title: "Pedidos" },
  products: { x: 1570, y: 190, width: 560, title: "Produtos" },
  order_items: { x: 1570, y: 630, width: 560, title: "Itens do pedido" },
  payment_attempts: { x: 1570, y: 1125, width: 560, title: "Tentativas de pagamento" },
};
const headerHeight = 62;
const rowHeight = 27;
const width = 2220;
const height = 1580;

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function label(x, y, value, color = "#6b5a53") {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700">${escapeXml(value)}</text>`;
}

function tableCard(name) {
  const rows = tables.get(name);
  const { x, y, width: cardWidth, title } = positions[name];
  const cardHeight = headerHeight + rows.length * rowHeight + 18;
  const headerColor = name === "schema_migrations" ? "#6b5a53" : "#a72c55";
  const result = [
    `<g filter="url(#shadow)"><rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="18" fill="#ffffff" stroke="#e9dcd3" stroke-width="2"/></g>`,
    `<path d="M${x + 18} ${y}H${x + cardWidth - 18}Q${x + cardWidth} ${y} ${x + cardWidth} ${y + 18}V${y + headerHeight}H${x}V${y + 18}Q${x} ${y} ${x + 18} ${y}Z" fill="${headerColor}"/>`,
    `<text x="${x + 22}" y="${y + 27}" fill="#fff9f4" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700">${escapeXml(title)}</text>`,
    `<text x="${x + 22}" y="${y + 50}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">${escapeXml(name)}</text>`,
    `<text x="${x + cardWidth - 22}" y="${y + 48}" text-anchor="end" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="16">${rows.length} campos</text>`,
  ];
  rows.forEach((row, index) => {
    const rowY = y + headerHeight + index * rowHeight;
    const baseline = rowY + 19;
    if (index % 2 === 0) result.push(`<rect x="${x + 2}" y="${rowY}" width="${cardWidth - 4}" height="${rowHeight}" fill="#fffaf7"/>`);
    result.push(`<text x="${x + 23}" y="${baseline}" fill="#30231f" font-family="Menlo, Consolas, monospace" font-size="17">${escapeXml(row.name)}</text>`);
    result.push(`<text x="${x + cardWidth - 175}" y="${baseline}" fill="#6b5a53" font-family="Menlo, Consolas, monospace" font-size="16">${row.type}${row.optional ? "?" : ""}</text>`);
    if (row.key) {
      result.push(`<rect x="${x + cardWidth - 65}" y="${rowY + 4}" width="42" height="19" rx="6" fill="${row.key === "FK" ? "#e7eff5" : "#f8e5e8"}"/>`);
      result.push(`<text x="${x + cardWidth - 44}" y="${rowY + 18}" text-anchor="middle" fill="${row.key === "FK" ? "#365f7a" : "#a72c55"}" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700">${row.key}</text>`);
    }
  });
  return result.join("\n");
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">Modelagem UML do banco SQLite da Doce &amp; Afeto</title>
  <desc id="description">Seis tabelas: products, orders, order_items, payment_attempts, site_reviews e schema_migrations. Pedidos têm itens e tentativas de pagamento; produtos aparecem em itens de pedido.</desc>
  <defs>
    <filter id="shadow" x="-15%" y="-15%" width="130%" height="140%"><feDropShadow dx="0" dy="7" stdDeviation="10" flood-color="#30231f" flood-opacity="0.08"/></filter>
  </defs>
  <rect width="${width}" height="${height}" fill="#fff9f4"/>
  <rect width="${width}" height="9" fill="#a72c55"/>
  <text x="90" y="83" fill="#30231f" font-family="Georgia, serif" font-size="48" font-weight="700">Modelagem de dados · SQLite</text>
  <text x="90" y="125" fill="#6b5a53" font-family="Arial, Helvetica, sans-serif" font-size="21">Doce &amp; Afeto — tabelas, campos e relacionamentos do projeto</text>

  <g fill="none" stroke="#a72c55" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1370 660H1470V765H1570"/>
    <path d="M1850 513V630"/>
    <path d="M1080 810V1250H1570"/>
  </g>
  ${label(1390, 650, "1")}
  ${label(1505, 752, "0..*")}
  ${label(1868, 550, "1")}
  ${label(1868, 615, "0..*")}
  ${label(1097, 850, "1")}
  ${label(1505, 1238, "0..*")}

  ${tableCard("site_reviews")}
  ${tableCard("schema_migrations")}
  ${tableCard("orders")}
  ${tableCard("products")}
  ${tableCard("order_items")}
  ${tableCard("payment_attempts")}

  <rect x="90" y="1020" width="580" height="330" rx="18" fill="#ffffff" stroke="#e9dcd3" stroke-width="2"/>
  <text x="116" y="1062" fill="#30231f" font-family="Georgia, serif" font-size="27" font-weight="700">Legenda e regras</text>
  <text x="116" y="1103" fill="#6b5a53" font-family="Arial, Helvetica, sans-serif" font-size="19">PK chave primária · FK chave estrangeira</text>
  <text x="116" y="1134" fill="#6b5a53" font-family="Arial, Helvetica, sans-serif" font-size="19">UQ valor único · ? campo opcional</text>
  <text x="116" y="1178" fill="#6b5a53" font-family="Arial, Helvetica, sans-serif" font-size="19">Valores monetários: INTEGER em centavos.</text>
  <text x="116" y="1209" fill="#6b5a53" font-family="Arial, Helvetica, sans-serif" font-size="19">Quantidade: 1 a 20 · Nota: 1 a 5.</text>
  <text x="116" y="1253" fill="#6b5a53" font-family="Arial, Helvetica, sans-serif" font-size="19">Capturas: BLOB em site_reviews.</text>
  <text x="116" y="1284" fill="#6b5a53" font-family="Arial, Helvetica, sans-serif" font-size="19">Itens e tentativas são apagados com o pedido.</text>
  <text x="116" y="1323" fill="#a72c55" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700">1 → 0..* indica um-para-muitos</text>

  <path d="M90 1460H2130" stroke="#e9dcd3" stroke-width="2"/>
  <text x="90" y="1500" fill="#6b5a53" font-family="Arial, Helvetica, sans-serif" font-size="18">Fonte: migrações SQLite 001–005 e schema_migrations criada pelo migrador.</text>
  <text x="2130" y="1500" text-anchor="end" fill="#a72c55" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700">PIT II · Doce &amp; Afeto</text>
</svg>`;

mkdirSync(directory, { recursive: true });
const svgPath = resolve(directory, "modelagem-dados-uml.svg");
writeFileSync(svgPath, svg);
try {
  const { default: sharp } = await import("sharp");
  await sharp(Buffer.from(svg), { density: 144 }).png().toFile(resolve(directory, "modelagem-dados-uml.png"));
  console.log("Diagrama SVG e PNG gerados em docs/.");
} catch (error) {
  console.warn("SVG gerado; não foi possível exportar PNG.", error);
}
