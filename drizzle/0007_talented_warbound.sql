CREATE TABLE "warehouse_people" (
	"id" text PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"name" text NOT NULL,
	"document" text NOT NULL,
	"position" text DEFAULT '' NOT NULL,
	"department" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_materials" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "material_requests" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_materials" ADD COLUMN "person_id" text;--> statement-breakpoint
ALTER TABLE "material_requests" ADD COLUMN "person_id" text;--> statement-breakpoint
ALTER TABLE "material_requests" ADD COLUMN "requester_details" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "material_requests" ADD COLUMN "submission_key" text;--> statement-breakpoint
ALTER TABLE "warehouse_people" ADD CONSTRAINT "warehouse_people_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_person_document_unique" ON "warehouse_people" USING btree ("warehouse_id","document");--> statement-breakpoint
ALTER TABLE "employee_materials" ADD CONSTRAINT "employee_materials_person_id_warehouse_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."warehouse_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_person_id_warehouse_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."warehouse_people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_submission_key_unique" UNIQUE("submission_key");
--> statement-breakpoint
WITH refs AS (
  SELECT p.user_id,p.warehouse_id FROM staff_profiles p WHERE EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=p.user_id AND r.name='empleado_agbc')
  UNION SELECT r.user_id,m.warehouse_id FROM material_requests r JOIN materials m ON m.id=r.material_id
  UNION SELECT user_id,warehouse_id FROM employee_materials
), source AS (
  SELECT u.id,u.name,u.is_active,u.created_at,refs.warehouse_id,
    coalesce(nullif(regexp_replace(upper(trim(p.document)),'\s','','g'),''),'LEGADO-'||u.id) AS document,
    coalesce(p.position,'') AS position,coalesce(p.department,'') AS department,coalesce(p.phone,'') AS phone
  FROM refs JOIN users u ON u.id=refs.user_id LEFT JOIN staff_profiles p ON p.user_id=u.id
)
INSERT INTO warehouse_people(id,warehouse_id,name,document,position,department,phone,is_active,created_at)
SELECT DISTINCT ON(warehouse_id,document) md5(warehouse_id||':'||document),warehouse_id,name,document,position,department,phone,is_active,created_at
FROM source ORDER BY warehouse_id,document,created_at,id;
--> statement-breakpoint
UPDATE material_requests r SET person_id=p.id,requester_details=jsonb_build_object('name',u.name,'document',p.document,'position',coalesce(sp.position,''),'department',coalesce(sp.department,''),'phone',coalesce(sp.phone,''))
FROM materials m,users u LEFT JOIN staff_profiles sp ON sp.user_id=u.id,warehouse_people p
WHERE r.material_id=m.id AND r.user_id=u.id AND p.warehouse_id=m.warehouse_id
AND p.document=coalesce(nullif(regexp_replace(upper(trim(sp.document)),'\s','','g'),''),'LEGADO-'||u.id);
--> statement-breakpoint
UPDATE employee_materials h SET person_id=p.id FROM users u LEFT JOIN staff_profiles sp ON sp.user_id=u.id,warehouse_people p
WHERE h.user_id=u.id AND p.warehouse_id=h.warehouse_id
AND p.document=coalesce(nullif(regexp_replace(upper(trim(sp.document)),'\s','','g'),''),'LEGADO-'||u.id);
--> statement-breakpoint
ALTER TABLE material_requests ALTER COLUMN person_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE employee_materials ALTER COLUMN person_id SET NOT NULL;
--> statement-breakpoint
DELETE FROM sessions s WHERE EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=s.user_id AND r.name='empleado_agbc')
AND NOT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=s.user_id AND r.name<>'empleado_agbc');
--> statement-breakpoint
UPDATE users u SET is_active=false,updated_at=now() WHERE EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name='empleado_agbc')
AND NOT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name<>'empleado_agbc');
