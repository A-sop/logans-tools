-- Priority bands from FPL 10 Aug 1959. Operational data. Not a signed policy letter.
-- Note: DABOS/docs/reference/dept21-executive-director/founder-desk/priority-order-1959.md

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority_reason TEXT;

UPDATE tasks AS t
SET priority = v.priority,
    priority_reason = v.reason,
    updated_at = NOW()
FROM (VALUES
  ('db4c4a5b-329a-4d0b-87c7-f42f7a78ca33'::uuid, 2, 'Financial, second interest: income is the index of whether promotion is reaching people. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('b513eba5-d785-4e68-8ddf-d1ea9d402e92'::uuid, 2, 'Financial, second interest: income is the index of whether promotion is reaching people. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('f1a3d86e-ab21-4de8-b487-4a5d1a39a526'::uuid, 2, 'Financial, second interest: income is the index of whether promotion is reaching people. Stays blocked pending founder OK. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('a37423d2-281c-401a-bb24-77df2dc2fe79'::uuid, 2, 'Financial, second interest: income is the index of whether promotion is reaching people. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('3d004b83-7720-4cf4-a392-32a6b8cd7322'::uuid, 2, 'Financial, second interest: income is the index of whether promotion is reaching people. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('9982ac88-d0b9-4e00-81c3-5bdff33e58a2'::uuid, 2, 'Financial, second interest: income is the index of whether promotion is reaching people. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('ef4e79fa-e7c0-4fcd-bca8-a080c071fa70'::uuid, 2, 'Financial, second interest: income is the index of whether promotion is reaching people. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('6dc78c6c-ec5d-4383-9e18-2196dea2bf05'::uuid, 3, 'Financial cans. Köln Q4 trade-tax advance €1,683 due 15 Nov 2026 (deferred). FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('f4382975-37d0-441d-9dc0-7a11068ad8f6'::uuid, 4, 'Third interest: effectiveness of the service. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('7b765054-e011-4fef-b628-09e34fafe10f'::uuid, 4, 'Third interest: effectiveness of the service. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('ecd531bc-0c6e-4eeb-aecc-6b5d9f3b419a'::uuid, 4, 'Third interest: effectiveness of the service. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('0979218e-62ae-4266-946d-a9a3055ca025'::uuid, 4, 'Third interest: effectiveness of the service. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('84e46f4f-53ce-468c-bd2f-9b84b0e01e00'::uuid, 4, 'Third interest: effectiveness of the service. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('dc63873f-b4e2-4ef8-a5ba-e9462e19c16b'::uuid, 4, 'Third interest: effectiveness of the service. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('2f1ed9de-f4dd-4c54-bdd8-7e672fa73ddc'::uuid, 4, 'Third interest: effectiveness of the service. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('4ab9fd0f-ea6c-47ae-a558-c118ec8f4fd0'::uuid, 4, 'Third interest: effectiveness of the service. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('529b744c-ec74-4bd5-9049-91f8c45d64e5'::uuid, 4, 'Third interest: effectiveness of the service. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('0c08596f-31cb-4f7b-bcc1-7b75c4504a36'::uuid, 4, 'Third interest: effectiveness of the service. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('0feda8ee-3e45-4893-9d14-36abd40aeeeb'::uuid, 4, 'Third interest: effectiveness of the service. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('a8505914-cd80-43f1-b43c-411a7016fea0'::uuid, 5, 'General state, finance first: statements book and bills book so solvency is visible. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('8abe9045-f9e4-4274-9e38-ba1f4722744c'::uuid, 5, 'General state, finance first: statements book and bills book so solvency is visible. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('65dcb987-3d40-442e-a6a7-fed1e74a512c'::uuid, 5, 'General state, finance first: statements book and bills book so solvency is visible. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('21a87e4d-5ae9-49ed-9935-fa582e34df9e'::uuid, 5, 'EXIT: archive and cancel the SaaS. General state, finance first. Not a categorize project. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('e66afb41-465a-468b-a6e3-6bc080c1f442'::uuid, 5, 'General state, finance first: statements book and bills book so solvency is visible. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('e14dfebe-a52d-406e-8058-8694ba20c80e'::uuid, 5, 'General state, finance first: statements book and bills book so solvency is visible. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('80c3dfd8-9107-41a8-8c28-ce9854daeecb'::uuid, 5, 'General state, finance first: statements book and bills book so solvency is visible. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('8f8228f9-ff45-4833-beac-bc38b9259e57'::uuid, 5, 'General state: the pulse has to be readable, not a false report of production. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('9d1c82a3-b170-47fb-86dd-3f72eab35ed2'::uuid, 5, 'General state: the pulse has to be readable, not a false report of production. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('6f234d8a-6e9f-4d7f-873f-1a3416832fd5'::uuid, 5, 'General state: the pulse has to be readable, not a false report of production. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('0b67e1e1-e3a2-4cc1-a837-47c09861648d'::uuid, 5, 'General state: the pulse has to be readable, not a false report of production. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('652860ba-bf43-4271-af1d-678dd794a25a'::uuid, 5, 'General state: the pulse has to be readable, not a false report of production. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('9c433f17-7d5f-43f0-bbc0-57f14dfa5197'::uuid, 5, 'General state: the pulse has to be readable, not a false report of production. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('9df69474-ab11-4120-ab0e-33be60fb4471'::uuid, 5, 'General state, materiel, after finance is visible. Not a Danger assignment. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('e6876a0c-a5af-47e8-bc59-ad6261ecbab5'::uuid, 5, 'General state, materiel, after finance is visible. Not a Danger assignment. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('c1d86185-41be-4e55-b38f-5be04f313c38'::uuid, 5, 'General state, materiel, after finance is visible. Not a Danger assignment. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('7622d32c-93b8-46e5-bb10-74c9137310f3'::uuid, 6, 'Parked. Do not run. Working condition stays Non-Existence. This row does not assign Danger. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('baa9f7ba-5d68-43f8-a294-a11dff077bd3'::uuid, 6, 'After these come other sections. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('3834b753-ce22-4b87-a651-8b37e0306690'::uuid, 6, 'After these come other sections. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('24aaf92c-2a80-4d39-9dfb-ccf98d832def'::uuid, 6, 'After these come other sections. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('08ce163e-58aa-48c2-ad6b-ca4893393387'::uuid, 6, 'After these come other sections. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('85a0e21c-73b1-457d-8163-1213d8e441e1'::uuid, 6, 'After these come other sections. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('cdbf215d-6f98-41ca-a0c7-379ae3cb76e1'::uuid, 6, 'After these come other sections. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('402134e3-ea48-486d-b742-66785f595191'::uuid, 6, 'After these come other sections. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('7e06c17e-4d74-4ddd-992b-d5b1bca020bf'::uuid, 6, 'After these come other sections. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('2b920137-befb-47dc-94ad-ecd358802767'::uuid, 6, 'After these come other sections. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('bae4c72c-1053-4885-9f35-c3c0e4b99997'::uuid, 6, 'After these come other sections. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('3766559b-37f1-4c80-8706-d857068de735'::uuid, 6, 'After these come other sections. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('f2d6d30e-8e47-4485-9bdf-f0370b292522'::uuid, 6, 'After these come other sections. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('1a620b60-4e82-4173-ae37-c367f6df2c63'::uuid, 6, 'After these come other sections. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.')
) AS v(id, priority, reason)
WHERE t.id = v.id
  AND t.status IN ('todo', 'doing', 'blocked', 'open');

UPDATE tasks AS t
SET status = 'cancelled',
    description = CASE
      WHEN COALESCE(t.description, '') LIKE '%Folded into %' THEN t.description
      ELSE COALESCE(t.description, '') || E'\n' || v.note
    END,
    updated_at = NOW()
FROM (VALUES
  ('d4e92f19-a240-4d4f-87c4-31aa39ed9326'::uuid, 'Folded into db4c4a5b-329a-4d0b-87c7-f42f7a78ca33. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('f722e224-620d-4a93-8178-f463649bec59'::uuid, 'Folded into db4c4a5b-329a-4d0b-87c7-f42f7a78ca33. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('9baa5198-9d71-4da4-be44-aea3b7b01834'::uuid, 'Folded into db4c4a5b-329a-4d0b-87c7-f42f7a78ca33. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('119c355d-20d8-45cd-9366-e800bfeff094'::uuid, 'Folded into db4c4a5b-329a-4d0b-87c7-f42f7a78ca33. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('bf5577b6-2679-4ba8-a694-b8cb847cda4d'::uuid, 'Folded into b513eba5-d785-4e68-8ddf-d1ea9d402e92. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('9e5d1998-d75b-455a-9c8a-147a87e67d75'::uuid, 'Folded into f1a3d86e-ab21-4de8-b487-4a5d1a39a526. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('bd6dd1ac-ce3a-4cfa-a1af-86027caa8e23'::uuid, 'Folded into f1a3d86e-ab21-4de8-b487-4a5d1a39a526. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('1433c7e5-9108-4e61-bbb7-57c5d1e3e570'::uuid, 'Folded into f1a3d86e-ab21-4de8-b487-4a5d1a39a526. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('88625e58-2612-408c-84f7-8f60da8bafb7'::uuid, 'Folded into f1a3d86e-ab21-4de8-b487-4a5d1a39a526. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('c6801d67-4ea6-4588-bbe1-5d0912c6052b'::uuid, 'Folded into 9982ac88-d0b9-4e00-81c3-5bdff33e58a2. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('1c885e47-a7f1-438a-84c3-7b2d33f3e391'::uuid, 'Folded into ef4e79fa-e7c0-4fcd-bca8-a080c071fa70. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('30b588c4-6cd6-4f18-9116-c281fc47f26a'::uuid, 'Folded into ef4e79fa-e7c0-4fcd-bca8-a080c071fa70. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('d9d8c21b-8efb-4bb9-aebf-c974acd1ee3e'::uuid, 'Folded into ef4e79fa-e7c0-4fcd-bca8-a080c071fa70. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('3db8a340-4135-477e-9eb4-55030c281f5c'::uuid, 'Folded into 6dc78c6c-ec5d-4383-9e18-2196dea2bf05. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('fda2824a-4a28-460e-b910-5370e8f814a2'::uuid, 'Folded into 6dc78c6c-ec5d-4383-9e18-2196dea2bf05. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('47ba8b97-1e02-496a-878b-823ac7c41466'::uuid, 'Folded into 6dc78c6c-ec5d-4383-9e18-2196dea2bf05. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('f37ceeda-21ea-4ee2-9adf-24db4781bd41'::uuid, 'Folded into 6dc78c6c-ec5d-4383-9e18-2196dea2bf05. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('cb31f959-f09e-4276-a65c-2dc1471baa57'::uuid, 'Folded into 9df69474-ab11-4120-ab0e-33be60fb4471. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('3a5698ab-c1a5-45fa-873b-a2f85ce76170'::uuid, 'Folded into 9df69474-ab11-4120-ab0e-33be60fb4471. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('3f885162-80a5-4c74-8a1b-d094e41cdb8f'::uuid, 'Folded into 9df69474-ab11-4120-ab0e-33be60fb4471. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('ce259f2e-ecbd-4c14-9c29-b17a33df74f0'::uuid, 'Folded into f4382975-37d0-441d-9dc0-7a11068ad8f6. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('96ce1f68-18db-46ff-a7d7-a836072654e9'::uuid, 'Folded into f4382975-37d0-441d-9dc0-7a11068ad8f6. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('0ce2713e-13ac-4268-b701-3a0c71b93e0d'::uuid, 'Folded into f4382975-37d0-441d-9dc0-7a11068ad8f6. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('4e1f43a8-aa41-43f7-b9fb-3f4c387c67e2'::uuid, 'Folded into f4382975-37d0-441d-9dc0-7a11068ad8f6. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('ea67e62e-1ce0-449c-9332-d0873d2d6c14'::uuid, 'Folded into f4382975-37d0-441d-9dc0-7a11068ad8f6. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('2432ebd8-cbc8-4445-a783-d1eb6464f898'::uuid, 'Folded into ecd531bc-0c6e-4eeb-aecc-6b5d9f3b419a. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('b66a6130-3745-47df-b643-ad710e9edb0c'::uuid, 'Folded into ecd531bc-0c6e-4eeb-aecc-6b5d9f3b419a. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('cbe9bfe3-ac94-45d9-9322-ce80f3499393'::uuid, 'Folded into dc63873f-b4e2-4ef8-a5ba-e9462e19c16b. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('1c0fbadf-af51-4318-8ebd-69f413872c42'::uuid, 'Folded into 4ab9fd0f-ea6c-47ae-a558-c118ec8f4fd0. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('fd5d7e14-776a-45b1-a532-43e75097a55b'::uuid, 'Folded into a8505914-cd80-43f1-b43c-411a7016fea0. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('502b3002-ad3f-44a2-8431-fc0357fc200e'::uuid, 'Folded into a8505914-cd80-43f1-b43c-411a7016fea0. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('6f2d265c-069b-47c7-aaeb-d718254a356d'::uuid, 'Folded into 8abe9045-f9e4-4274-9e38-ba1f4722744c. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('da5dab56-6621-40c9-928b-36140b730b91'::uuid, 'Folded into 8abe9045-f9e4-4274-9e38-ba1f4722744c. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('945b870d-7fda-41be-9534-5930f0a8d31d'::uuid, 'Folded into 8abe9045-f9e4-4274-9e38-ba1f4722744c. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('835897fe-60ef-477f-8bb7-a700579f544e'::uuid, 'Folded into 8abe9045-f9e4-4274-9e38-ba1f4722744c. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('a2fe14ae-cb4f-40c0-922d-2050f47e4ea2'::uuid, 'Folded into 8abe9045-f9e4-4274-9e38-ba1f4722744c. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('1e8d7302-e2e3-4ade-adf6-3674961bd5a1'::uuid, 'Folded into 21a87e4d-5ae9-49ed-9935-fa582e34df9e. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('ca1de99a-6e0c-4842-b03f-9fee29d792c8'::uuid, 'Folded into e66afb41-465a-468b-a6e3-6bc080c1f442. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('007b5acd-854b-4634-84c8-7e7c0c865407'::uuid, 'Folded into e66afb41-465a-468b-a6e3-6bc080c1f442. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('ec816847-d87c-4b51-a380-aa301c803506'::uuid, 'Folded into e66afb41-465a-468b-a6e3-6bc080c1f442. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('1d086102-8b08-4e10-9c03-568930980261'::uuid, 'Folded into 8f8228f9-ff45-4833-beac-bc38b9259e57. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('0f57770f-cc8a-4f9d-868e-ff5031bea76b'::uuid, 'Folded into 8f8228f9-ff45-4833-beac-bc38b9259e57. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('d01065cb-fe14-42de-b107-58fb25aea7df'::uuid, 'Folded into 8f8228f9-ff45-4833-beac-bc38b9259e57. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('4f55c475-e311-4102-b008-408ec0854018'::uuid, 'Folded into 8f8228f9-ff45-4833-beac-bc38b9259e57. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('8d11f6c4-8fb9-405c-a098-a18ad9535332'::uuid, 'Folded into 8f8228f9-ff45-4833-beac-bc38b9259e57. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('cf0e5e65-1434-405c-bdbe-34fca73c6bb6'::uuid, 'Folded into 8f8228f9-ff45-4833-beac-bc38b9259e57. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('a85f646d-2eb9-4015-9c84-25f779cdc9f2'::uuid, 'Folded into 8f8228f9-ff45-4833-beac-bc38b9259e57. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('283ecc37-19f2-4c9e-b3ff-35a7e7ac0c13'::uuid, 'Folded into 8f8228f9-ff45-4833-beac-bc38b9259e57. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('c1d587c8-4192-4ef8-948b-da3f39aa303d'::uuid, 'Folded into 6f234d8a-6e9f-4d7f-873f-1a3416832fd5. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('451f5032-57c6-4ff7-9c42-4196f8a719df'::uuid, 'Folded into 652860ba-bf43-4271-af1d-678dd794a25a. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('f3904a8c-17fe-480c-b2e0-63533632df51'::uuid, 'Folded into 24aaf92c-2a80-4d39-9dfb-ccf98d832def. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('2090c443-9657-469c-93a6-0b2820ce2035'::uuid, 'Folded into cdbf215d-6f98-41ca-a0c7-379ae3cb76e1. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('e62332bc-36fb-467a-aa0f-4ed052df7802'::uuid, 'Folded into cdbf215d-6f98-41ca-a0c7-379ae3cb76e1. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('7b160fda-8a92-47c3-8247-84e83b788f78'::uuid, 'Folded into cdbf215d-6f98-41ca-a0c7-379ae3cb76e1. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.'),
  ('e4594924-5a6d-41a8-b709-d99a19e4adf6'::uuid, 'Folded into 7e06c17e-4d74-4ddd-992b-d5b1bca020bf. Same particle, not a second open task. FPL 10 Aug 1959, DATA REQUIRED AS REPORTS FROM FCO SECS.')
) AS v(id, note)
WHERE t.id = v.id
  AND t.status IN ('todo', 'doing', 'blocked', 'open');

UPDATE departments
SET policy_text = policy_text || ' Priority order (operational note, not a signed letter): FPL 10 Aug 1959 — promotion, then financial, then the service, then general state, then the rest. A lower band does not mean stop working. docs/reference/dept21-executive-director/founder-desk/priority-order-1959.md. Does not assign a condition.'
WHERE policy_text IS NOT NULL
  AND policy_text NOT LIKE '%FPL 10 Aug 1959%';

UPDATE departments
SET policy_text = replace(
  policy_text,
  ' Priority order (operational note, not a signed letter): FPL 10 Aug 1959 — promotion, then financial, then the service, then general state. docs/reference/dept21-executive-director/founder-desk/priority-order-1959.md. Does not assign a condition.',
  ' Priority order (operational note, not a signed letter): FPL 10 Aug 1959 — promotion, then financial, then the service, then general state, then the rest. A lower band does not mean stop working. docs/reference/dept21-executive-director/founder-desk/priority-order-1959.md. Does not assign a condition.'
)
WHERE policy_text LIKE '%FPL 10 Aug 1959%'
  AND policy_text NOT LIKE '%does not mean stop working%';
