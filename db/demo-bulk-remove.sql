-- Retire demo-bulk.sql : seules les lignes « [Démo] » et « (démo) » et les lecteurs fictifs
-- demo.NN@exemple.test ; les genres ajoutés restent.
-- Exécution : `npm run db:seed:bulk:remove` (api/).
DELETE FROM library_entry
 WHERE work_id IN (SELECT id FROM work WHERE title LIKE '[Démo] %')
    OR user_id IN (SELECT id FROM app_user WHERE email LIKE 'demo.%@exemple.test');
DELETE FROM app_user WHERE email LIKE 'demo.%@exemple.test';
DELETE FROM work WHERE title LIKE '[Démo] %';
DELETE FROM person WHERE name LIKE '% (démo)';
DELETE FROM publisher WHERE name LIKE '% (démo)';
