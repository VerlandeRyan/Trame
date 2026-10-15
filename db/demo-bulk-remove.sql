-- Retire demo-bulk.sql : seules les lignes « [Démo] » et « (démo) » ; les genres ajoutés restent.
-- Exécution : `npm run db:seed:bulk:remove` (api/).
DELETE FROM work WHERE title LIKE '[Démo] %';
DELETE FROM person WHERE name LIKE '% (démo)';
DELETE FROM publisher WHERE name LIKE '% (démo)';
