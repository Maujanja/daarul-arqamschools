export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      academic_years: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          is_current: boolean
          start_date: string | null
          year_name: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          start_date?: string | null
          year_name: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          start_date?: string | null
          year_name?: string
        }
        Relationships: []
      }
      admin_credentials: {
        Row: {
          created_at: string | null
          id: string
          password_hash: string
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          password_hash: string
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          password_hash?: string
          username?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          academic_year: string | null
          content: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
          visibility_type: string | null
        }
        Insert: {
          academic_year?: string | null
          content: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
          visibility_type?: string | null
        }
        Update: {
          academic_year?: string | null
          content?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          visibility_type?: string | null
        }
        Relationships: []
      }
      family_group_installments: {
        Row: {
          academic_year: string
          amount: number
          created_at: string
          due_date: string
          family_group_id: string
          id: string
          installment_number: number
        }
        Insert: {
          academic_year: string
          amount?: number
          created_at?: string
          due_date: string
          family_group_id: string
          id?: string
          installment_number: number
        }
        Update: {
          academic_year?: string
          amount?: number
          created_at?: string
          due_date?: string
          family_group_id?: string
          id?: string
          installment_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "family_group_installments_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      family_group_members: {
        Row: {
          academic_year: string
          created_at: string
          family_group_id: string
          id: string
          student_id: string
        }
        Insert: {
          academic_year?: string
          created_at?: string
          family_group_id: string
          id?: string
          student_id: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          family_group_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_group_members_family_group_id_fkey"
            columns: ["family_group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      family_groups: {
        Row: {
          academic_year: string
          created_at: string
          id: string
          notes: string | null
          parent_name: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          created_at?: string
          id?: string
          notes?: string | null
          parent_name: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          id?: string
          notes?: string | null
          parent_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fee_installments: {
        Row: {
          academic_year: string
          amount: number
          boarding_type: string
          class: string
          created_at: string
          due_date: string
          id: string
          installment_number: number
        }
        Insert: {
          academic_year: string
          amount?: number
          boarding_type?: string
          class: string
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
        }
        Update: {
          academic_year?: string
          amount?: number
          boarding_type?: string
          class?: string
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
        }
        Relationships: []
      }
      fee_payments: {
        Row: {
          academic_year: string
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          receipt_number: string | null
          recorded_by: string | null
          student_id: string
          term: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          receipt_number?: string | null
          recorded_by?: string | null
          student_id: string
          term: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          receipt_number?: string | null
          recorded_by?: string | null
          student_id?: string
          term?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structure: {
        Row: {
          academic_year: string
          boarding_fee: number | null
          boarding_type: string | null
          class: string
          created_at: string
          id: string
          other_fees: number | null
          term: string
          total_fee: number
          tuition_fee: number
        }
        Insert: {
          academic_year: string
          boarding_fee?: number | null
          boarding_type?: string | null
          class: string
          created_at?: string
          id?: string
          other_fees?: number | null
          term: string
          total_fee?: number
          tuition_fee?: number
        }
        Update: {
          academic_year?: string
          boarding_fee?: number | null
          boarding_type?: string | null
          class?: string
          created_at?: string
          id?: string
          other_fees?: number | null
          term?: string
          total_fee?: number
          tuition_fee?: number
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          parent_id: string
          recipient_type: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          parent_id: string
          recipient_type?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          parent_id?: string
          recipient_type?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      marks: {
        Row: {
          academic_year: string
          class: string
          created_at: string
          exam: number
          grade: string
          id: string
          stream: string | null
          student_id: string
          subject_id: string
          teacher_id: string | null
          term: string
          total: number
          updated_at: string
        }
        Insert: {
          academic_year: string
          class: string
          created_at?: string
          exam?: number
          grade?: string
          id?: string
          stream?: string | null
          student_id: string
          subject_id: string
          teacher_id?: string | null
          term: string
          total?: number
          updated_at?: string
        }
        Update: {
          academic_year?: string
          class?: string
          created_at?: string
          exam?: number
          grade?: string
          id?: string
          stream?: string | null
          student_id?: string
          subject_id?: string
          teacher_id?: string | null
          term?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      marks_unlock_requests: {
        Row: {
          academic_year: string
          admin_note: string | null
          class: string
          created_at: string
          current_marks: number | null
          id: string
          reason: string | null
          status: string
          stream: string | null
          student_id: string | null
          student_name: string | null
          subject_id: string
          subject_name: string
          teacher_id: string
          teacher_name: string
          term: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          admin_note?: string | null
          class: string
          created_at?: string
          current_marks?: number | null
          id?: string
          reason?: string | null
          status?: string
          stream?: string | null
          student_id?: string | null
          student_name?: string | null
          subject_id: string
          subject_name: string
          teacher_id: string
          teacher_name: string
          term: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          admin_note?: string | null
          class?: string
          created_at?: string
          current_marks?: number | null
          id?: string
          reason?: string | null
          status?: string
          stream?: string | null
          student_id?: string | null
          student_name?: string | null
          subject_id?: string
          subject_name?: string
          teacher_id?: string
          teacher_name?: string
          term?: string
          updated_at?: string
        }
        Relationships: []
      }
      parents: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      secretary_credentials: {
        Row: {
          created_at: string | null
          full_name: string
          id: string
          password_hash: string
          username: string
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id?: string
          password_hash: string
          username: string
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          password_hash?: string
          username?: string
        }
        Relationships: []
      }
      student_custom_installments: {
        Row: {
          academic_year: string
          amount: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          notes: string | null
          student_id: string
        }
        Insert: {
          academic_year: string
          amount?: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          notes?: string | null
          student_id: string
        }
        Update: {
          academic_year?: string
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          notes?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_custom_installments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_debt_history: {
        Row: {
          academic_year: string
          amount_paid: number
          cleared_at: string | null
          cleared_by: string | null
          created_at: string
          id: string
          is_cleared: boolean
          notes: string | null
          original_amount: number
          outstanding_balance: number
          student_id: string
          term: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          amount_paid?: number
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          id?: string
          is_cleared?: boolean
          notes?: string | null
          original_amount?: number
          outstanding_balance?: number
          student_id: string
          term: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          amount_paid?: number
          cleared_at?: string | null
          cleared_by?: string | null
          created_at?: string
          id?: string
          is_cleared?: boolean
          notes?: string | null
          original_amount?: number
          outstanding_balance?: number
          student_id?: string
          term?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_debt_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          admission_date: string
          avatar_url: string | null
          boarding_type: string | null
          class: string
          created_at: string
          custom_fee: number | null
          discount_notes: string | null
          full_name: string
          gender: string | null
          id: string
          parent_id: string | null
          roll_number: string
          stream: string | null
          updated_at: string
        }
        Insert: {
          admission_date?: string
          avatar_url?: string | null
          boarding_type?: string | null
          class: string
          created_at?: string
          custom_fee?: number | null
          discount_notes?: string | null
          full_name: string
          gender?: string | null
          id?: string
          parent_id?: string | null
          roll_number: string
          stream?: string | null
          updated_at?: string
        }
        Update: {
          admission_date?: string
          avatar_url?: string | null
          boarding_type?: string | null
          class?: string
          created_at?: string
          custom_fee?: number | null
          discount_notes?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          parent_id?: string | null
          roll_number?: string
          stream?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_parent"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string
          created_at: string
          id: string
          max_marks: number
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          max_marks?: number
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          max_marks?: number
          name?: string
        }
        Relationships: []
      }
      teacher_assignments: {
        Row: {
          academic_year: string
          class: string
          created_at: string
          id: string
          stream: string | null
          subject_id: string
          teacher_id: string
        }
        Insert: {
          academic_year?: string
          class: string
          created_at?: string
          id?: string
          stream?: string | null
          subject_id: string
          teacher_id: string
        }
        Update: {
          academic_year?: string
          class?: string
          created_at?: string
          id?: string
          stream?: string | null
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_class_students: {
        Row: {
          academic_year: string
          class: string
          created_at: string
          id: string
          stream: string | null
          student_id: string
          subject_id: string
          teacher_id: string
        }
        Insert: {
          academic_year?: string
          class: string
          created_at?: string
          id?: string
          stream?: string | null
          student_id: string
          subject_id: string
          teacher_id: string
        }
        Update: {
          academic_year?: string
          class?: string
          created_at?: string
          id?: string
          stream?: string | null
          student_id?: string
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_class_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_class_students_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_class_students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_class_students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          classes: string[]
          created_at: string
          email: string
          full_name: string
          id: string
          password_hash: string | null
          subjects: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          classes?: string[]
          created_at?: string
          email: string
          full_name: string
          id?: string
          password_hash?: string | null
          subjects?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          classes?: string[]
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          password_hash?: string | null
          subjects?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_credentials_public: {
        Row: {
          created_at: string | null
          id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      secretary_credentials_public: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      teachers_public: {
        Row: {
          classes: string[] | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          subjects: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          classes?: string[] | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          subjects?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          classes?: string[] | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          subjects?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "parent"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "teacher", "parent"],
    },
  },
} as const
