DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.paie_enregistrer_bulletin'::regproc);
  d := replace(d, '''413'',''I.T.S''', '''401'',''ITS (Part salariale)''');
  d := replace(d, '''776'',''Retenue CMU'',NULL,NULL,NULL,0,cmu,''non_imposable''', '''470'',''CMU (Couverture Maladie Univ.)'',NULL,NULL,NULL,0,cmu,''retenue''');
  EXECUTE d;
END $$;
ALTER TABLE public.employes ADD COLUMN IF NOT EXISTS civilite text CHECK (civilite IN ('M','Mlle','Mme'));
UPDATE public.employes SET civilite = CASE WHEN sexe='M' THEN 'M' WHEN sexe='F' AND situation_matrimoniale='celibataire' THEN 'Mlle' WHEN sexe='F' THEN 'Mme' END WHERE civilite IS NULL;