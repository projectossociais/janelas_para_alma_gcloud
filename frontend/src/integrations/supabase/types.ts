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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_permissions: {
        Row: {
          can_banners: boolean | null
          can_content: boolean | null
          can_inbox: boolean | null
          can_manage_admins: boolean | null
          can_notifications: boolean | null
          can_overview: boolean | null
          can_users: boolean | null
          created_at: string
          id: string
          is_super: boolean | null
          user_id: string
        }
        Insert: {
          can_banners?: boolean | null
          can_content?: boolean | null
          can_inbox?: boolean | null
          can_manage_admins?: boolean | null
          can_notifications?: boolean | null
          can_overview?: boolean | null
          can_users?: boolean | null
          created_at?: string
          id?: string
          is_super?: boolean | null
          user_id: string
        }
        Update: {
          can_banners?: boolean | null
          can_content?: boolean | null
          can_inbox?: boolean | null
          can_manage_admins?: boolean | null
          can_notifications?: boolean | null
          can_overview?: boolean | null
          can_users?: boolean | null
          created_at?: string
          id?: string
          is_super?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          ativo: boolean | null
          created_at: string
          id: string
          link: string | null
          mensagem: string
          titulo: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          link?: string | null
          mensagem: string
          titulo: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          link?: string | null
          mensagem?: string
          titulo?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          assunto: string | null
          created_at: string
          email: string
          id: string
          lida: boolean | null
          mensagem: string
          nome: string
        }
        Insert: {
          assunto?: string | null
          created_at?: string
          email: string
          id?: string
          lida?: boolean | null
          mensagem: string
          nome: string
        }
        Update: {
          assunto?: string | null
          created_at?: string
          email?: string
          id?: string
          lida?: boolean | null
          mensagem?: string
          nome?: string
        }
        Relationships: []
      }
      dados_bancarios: {
        Row: {
          ativo: boolean | null
          created_at: string
          iban: string | null
          id: string
          numero: string
          tipo: string
          titular: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          iban?: string | null
          id?: string
          numero: string
          tipo: string
          titular: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          iban?: string | null
          id?: string
          numero?: string
          tipo?: string
          titular?: string
        }
        Relationships: []
      }
      doacoes: {
        Row: {
          created_at: string
          detalhes: string | null
          email: string
          id: string
          materiais: string[] | null
          recibo_id: string | null
          status: string | null
          tipo: string
          valor: number | null
        }
        Insert: {
          created_at?: string
          detalhes?: string | null
          email: string
          id?: string
          materiais?: string[] | null
          recibo_id?: string | null
          status?: string | null
          tipo: string
          valor?: number | null
        }
        Update: {
          created_at?: string
          detalhes?: string | null
          email?: string
          id?: string
          materiais?: string[] | null
          recibo_id?: string | null
          status?: string | null
          tipo?: string
          valor?: number | null
        }
        Relationships: []
      }
      doacoes_materiais: {
        Row: {
          categorias: string[]
          contactado: boolean
          criado_em: string
          detalhes: string | null
          email: string | null
          id: string
        }
        Insert: {
          categorias: string[]
          contactado?: boolean
          criado_em?: string
          detalhes?: string | null
          email?: string | null
          id?: string
        }
        Update: {
          categorias?: string[]
          contactado?: boolean
          criado_em?: string
          detalhes?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      exames: {
        Row: {
          created_at: string
          id: string
          observacoes: string | null
          resultado: Json | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          observacoes?: string | null
          resultado?: Json | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          observacoes?: string | null
          resultado?: Json | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lida: boolean | null
          mensagem: string
          titulo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean | null
          mensagem: string
          titulo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean | null
          mensagem?: string
          titulo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pontos_recolha: {
        Row: {
          ativo: boolean | null
          contacto: string | null
          created_at: string
          endereco: string
          horario: string | null
          id: string
          nome: string
          provincia: string
        }
        Insert: {
          ativo?: boolean | null
          contacto?: string | null
          created_at?: string
          endereco: string
          horario?: string | null
          id?: string
          nome: string
          provincia?: string
        }
        Update: {
          ativo?: boolean | null
          contacto?: string | null
          created_at?: string
          endereco?: string
          horario?: string | null
          id?: string
          nome?: string
          provincia?: string
        }
        Relationships: []
      }
      premium_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          plano: string | null
          status: string | null
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nome: string
          plano?: string | null
          status?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          plano?: string | null
          status?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          biografia: string | null
          created_at: string
          data_nascimento: string | null
          // Adicionada junto da migração 20260831120000 — NÃO confirmada
          // contra a base de dados real (projecto inacessível no momento em
          // que esta linha foi escrita). Reconfirmar assim que o Supabase
          // voltar a responder — ver CLAUDE.md secção 5.
          eliminar_agendado_para: string | null
          email: string | null
          genero: string | null
          id: string
          nome: string | null
          nome_completo: string | null
          notificacoes_comunidade: boolean | null
          notificacoes_lembretes: boolean | null
          notificacoes_projetos: boolean | null
          papel: string | null
          provincia: string | null
          telefone: string | null
        }
        Insert: {
          avatar_url?: string | null
          biografia?: string | null
          created_at?: string
          data_nascimento?: string | null
          eliminar_agendado_para?: string | null
          email?: string | null
          genero?: string | null
          id: string
          nome?: string | null
          nome_completo?: string | null
          notificacoes_comunidade?: boolean | null
          notificacoes_lembretes?: boolean | null
          notificacoes_projetos?: boolean | null
          papel?: string | null
          provincia?: string | null
          telefone?: string | null
        }
        Update: {
          avatar_url?: string | null
          biografia?: string | null
          created_at?: string
          data_nascimento?: string | null
          eliminar_agendado_para?: string | null
          email?: string | null
          genero?: string | null
          id?: string
          nome?: string | null
          nome_completo?: string | null
          notificacoes_comunidade?: boolean | null
          notificacoes_lembretes?: boolean | null
          notificacoes_projetos?: boolean | null
          papel?: string | null
          provincia?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      scanner_analyses: {
        Row: {
          created_at: string
          dados_clinicos: Json
          diagnostico: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dados_clinicos: Json
          diagnostico?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dados_clinicos?: Json
          diagnostico?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      screenings: {
        Row: {
          assimetria_horizontal: number | null
          assimetria_vertical: number | null
          consentimento_imagem: boolean
          criado_em: string
          encaminhado: boolean
          estado: string
          id: string
          imagem_path: string | null
          medicoes: Json | null
          qualidade_captura: number | null
          qualidade_fiavel: boolean | null
          qualidade_motivos: string[]
          requer_avaliacao_humana: boolean
          rosto_detetado: boolean
          user_id: string
          versao_analise: string | null
        }
        Insert: {
          assimetria_horizontal?: number | null
          assimetria_vertical?: number | null
          consentimento_imagem?: boolean
          criado_em?: string
          encaminhado?: boolean
          estado: string
          id?: string
          imagem_path?: string | null
          medicoes?: Json | null
          qualidade_captura?: number | null
          qualidade_fiavel?: boolean | null
          qualidade_motivos?: string[]
          requer_avaliacao_humana: boolean
          rosto_detetado: boolean
          user_id: string
          versao_analise?: string | null
        }
        Update: {
          assimetria_horizontal?: number | null
          assimetria_vertical?: number | null
          consentimento_imagem?: boolean
          criado_em?: string
          encaminhado?: boolean
          estado?: string
          id?: string
          imagem_path?: string | null
          medicoes?: Json | null
          qualidade_captura?: number | null
          qualidade_fiavel?: boolean | null
          qualidade_motivos?: string[]
          requer_avaliacao_humana?: boolean
          rosto_detetado?: boolean
          user_id?: string
          versao_analise?: string | null
        }
        Relationships: []
      }
      sessoes_exercicio: {
        Row: {
          created_at: string
          detalhes: Json | null
          duracao_segundos: number
          exercicio_id: string
          id: string
          pontuacao: number
          precisao_percentual: number
          user_id: string
        }
        Insert: {
          created_at?: string
          detalhes?: Json | null
          duracao_segundos: number
          exercicio_id: string
          id?: string
          pontuacao?: number
          precisao_percentual?: number
          user_id: string
        }
        Update: {
          created_at?: string
          detalhes?: Json | null
          duracao_segundos?: number
          exercicio_id?: string
          id?: string
          pontuacao?: number
          precisao_percentual?: number
          user_id?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          chave: string
          id: string
          updated_at: string
          valor: Json
        }
        Insert: {
          chave: string
          id?: string
          updated_at?: string
          valor: Json
        }
        Update: {
          chave?: string
          id?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          avaliacao: number | null
          comentario: string | null
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          avaliacao?: number | null
          comentario?: string | null
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          avaliacao?: number | null
          comentario?: string | null
          created_at?: string
          id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      [_ in never]: never
    }
    Functions: {
      has_role:
        | { Args: { _role: string }; Returns: boolean }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "comum"
        | "voluntario"
        | "oftalmologista"
        | "profissional"
        | "estrabico"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "admin",
        "comum",
        "voluntario",
        "oftalmologista",
        "profissional",
        "estrabico",
      ],
    },
  },
} as const
