
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "crm": {
          Tables: {
            "activities": {
                  Row: {
                    "author_id": string,"company_id": string,"contact_id": string | null,"id": string,"kind": Database["crm"]['Enums']["activity_kind"],"occurred_at": string,"sandbox_id": string,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"company_id": string,"contact_id"?: string | null,"id"?: string,"kind": Database["crm"]['Enums']["activity_kind"],"occurred_at"?: string,"sandbox_id"?: string,"text": string
                  }
                  Update: {
                    "author_id"?: string,"company_id"?: string,"contact_id"?: string | null,"id"?: string,"kind"?: Database["crm"]['Enums']["activity_kind"],"occurred_at"?: string,"sandbox_id"?: string,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activities_sandbox_id_author_id_fkey"
      columns: ["sandbox_id","author_id"]
isOneToOne: false
      referencedRelation: "teammates"
      referencedColumns: ["sandbox_id","id"]
    },{
      foreignKeyName: "activities_sandbox_id_company_id_contact_id_fkey"
      columns: ["sandbox_id","company_id","contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["sandbox_id","company_id","id"]
    },{
      foreignKeyName: "activities_sandbox_id_company_id_fkey"
      columns: ["sandbox_id","company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["sandbox_id","id"]
    },{
      foreignKeyName: "activities_sandbox_id_fkey"
      columns: ["sandbox_id"]
isOneToOne: false
      referencedRelation: "sandboxes"
      referencedColumns: ["id"]
    }
                  ]
                },"companies": {
                  Row: {
                    "added_at": string,"city": string,"id": string,"industry": string,"name": string,"owner_id": string,"sandbox_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"city"?: string,"id"?: string,"industry"?: string,"name": string,"owner_id": string,"sandbox_id"?: string
                  }
                  Update: {
                    "added_at"?: string,"city"?: string,"id"?: string,"industry"?: string,"name"?: string,"owner_id"?: string,"sandbox_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "companies_sandbox_id_fkey"
      columns: ["sandbox_id"]
isOneToOne: false
      referencedRelation: "sandboxes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "companies_sandbox_id_owner_id_fkey"
      columns: ["sandbox_id","owner_id"]
isOneToOne: false
      referencedRelation: "teammates"
      referencedColumns: ["sandbox_id","id"]
    }
                  ]
                },"contacts": {
                  Row: {
                    "company_id": string,"email": string,"id": string,"job_title": string,"name": string,"phone": string,"sandbox_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "company_id": string,"email"?: string,"id"?: string,"job_title"?: string,"name": string,"phone"?: string,"sandbox_id"?: string
                  }
                  Update: {
                    "company_id"?: string,"email"?: string,"id"?: string,"job_title"?: string,"name"?: string,"phone"?: string,"sandbox_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_sandbox_id_company_id_fkey"
      columns: ["sandbox_id","company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["sandbox_id","id"]
    },{
      foreignKeyName: "contacts_sandbox_id_fkey"
      columns: ["sandbox_id"]
isOneToOne: false
      referencedRelation: "sandboxes"
      referencedColumns: ["id"]
    }
                  ]
                },"sandboxes": {
                  Row: {
                    "created_at": string,"expires_at": string | null,"id": string,"is_template": boolean,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at"?: string | null,"id"?: string,"is_template"?: boolean,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string | null,"id"?: string,"is_template"?: boolean,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"teammates": {
                  Row: {
                    "first_name": string,"id": string,"initials": string,"is_persona": boolean,"last_name": string,"role": string,"sandbox_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "first_name": string,"id"?: string,"initials": string,"is_persona"?: boolean,"last_name": string,"role": string,"sandbox_id"?: string
                  }
                  Update: {
                    "first_name"?: string,"id"?: string,"initials"?: string,"is_persona"?: boolean,"last_name"?: string,"role"?: string,"sandbox_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teammates_sandbox_id_fkey"
      columns: ["sandbox_id"]
isOneToOne: false
      referencedRelation: "sandboxes"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "current_sandbox_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"fill_sandbox":
{ Args: { "target": string }; Returns: undefined
                           },
"open_sandbox":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,
"expires_at": string | null,
"id": string,
"is_template": boolean,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "sandboxes"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "activity_kind": "Email"|"Call"|"Meeting"|"Note"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "crm">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "crm": {
          Enums: {
            "activity_kind": ["Email", "Call", "Meeting", "Note"]
          }
        }
} as const
