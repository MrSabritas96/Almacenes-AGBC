CREATE TABLE IF NOT EXISTS act_procedencias (
 clave text PRIMARY KEY,
 nombre text NOT NULL UNIQUE,
 prefijo text NOT NULL UNIQUE,
 activa boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1,
 creado_en timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT act_procedencia_nombre_ck CHECK (length(trim(nombre)) BETWEEN 2 AND 80)
);
INSERT INTO act_procedencias(clave,nombre,prefijo) VALUES
 ('AGBC','AGBC','AGBC-NUEVO-'),('EXECOBOL 2024','EXECOBOL','EXECOBOL-NUEVO-'),
 ('UPU','UPU','UPU-NUEVO-'),('PACTA','PACTA','PACTA-NUEVO-'),('MOPSV','MOPSV','MOPSV-NUEVO-'),('UPAEP','UPAEP','UPAEP-NUEVO-')
 ON CONFLICT(clave) DO NOTHING;
INSERT INTO act_procedencias(clave,nombre,prefijo,activa)
 SELECT origen,origen,'P-' || upper(substr(md5(origen),1,12)) || '-',false FROM (
 SELECT DISTINCT origen FROM act_activos UNION SELECT DISTINCT procedencia FROM act_documentos_archivo
 UNION SELECT DISTINCT cabecera->>'entidad' FROM act_actas
 ) p WHERE origen IS NOT NULL AND trim(origen)<>''
 ON CONFLICT DO NOTHING;
