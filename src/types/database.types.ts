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
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      approval_bundle_items: {
        Row: {
          artwork_id: string
          artwork_label: string
          created_at: string
          id: string
          sort_order: number
          token_id: string
        }
        Insert: {
          artwork_id: string
          artwork_label?: string
          created_at?: string
          id?: string
          sort_order?: number
          token_id: string
        }
        Update: {
          artwork_id?: string
          artwork_label?: string
          created_at?: string
          id?: string
          sort_order?: number
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_bundle_items_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_bundle_items_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "approval_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_tokens: {
        Row: {
          artwork_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          is_bundle: boolean
          order_id: string
          token: string
          used_at: string | null
          used_by_name: string | null
        }
        Insert: {
          artwork_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          is_bundle?: boolean
          order_id: string
          token?: string
          used_at?: string | null
          used_by_name?: string | null
        }
        Update: {
          artwork_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_bundle?: boolean
          order_id?: string
          token?: string
          used_at?: string | null
          used_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_tokens_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      artworks: {
        Row: {
          adjustment_notes: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          is_internal_decision: boolean | null
          order_id: string
          status: Database["public"]["Enums"]["artwork_status"]
          updated_at: string
          uploaded_by: string | null
          variation_index: number
          version: number
        }
        Insert: {
          adjustment_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          is_internal_decision?: boolean | null
          order_id: string
          status?: Database["public"]["Enums"]["artwork_status"]
          updated_at?: string
          uploaded_by?: string | null
          variation_index?: number
          version?: number
        }
        Update: {
          adjustment_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          is_internal_decision?: boolean | null
          order_id?: string
          status?: Database["public"]["Enums"]["artwork_status"]
          updated_at?: string
          uploaded_by?: string | null
          variation_index?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "artworks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artworks_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          order_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          order_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          order_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          checklist_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          is_completed: boolean
          position: number
          text: string
        }
        Insert: {
          checklist_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          position?: number
          text: string
        }
        Update: {
          checklist_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          position?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          created_at: string
          id: string
          order_id: string
          position: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          position?: number
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          city: string | null
          company: string | null
          complement: string | null
          country: string | null
          created_at: string
          created_by: string | null
          document: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          number: string | null
          person_type: Database["public"]["Enums"]["person_type"]
          phone: string | null
          state: string | null
          street: string | null
          tiny_id: number | null
          tiny_synced_at: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          company?: string | null
          complement?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          person_type?: Database["public"]["Enums"]["person_type"]
          phone?: string | null
          state?: string | null
          street?: string | null
          tiny_id?: number | null
          tiny_synced_at?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          company?: string | null
          complement?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          person_type?: Database["public"]["Enums"]["person_type"]
          phone?: string | null
          state?: string | null
          street?: string | null
          tiny_id?: number | null
          tiny_synced_at?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_system: boolean | null
          mentions: string[] | null
          order_id: string
          read_at: string | null
          read_by: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_system?: boolean | null
          mentions?: string[] | null
          order_id: string
          read_at?: string | null
          read_by?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_system?: boolean | null
          mentions?: string[] | null
          order_id?: string
          read_at?: string | null
          read_by?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string | null
          push_sent: boolean
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          push_sent?: boolean
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          push_sent?: boolean
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_history: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          order_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          order_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          order_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_history_reads: {
        Row: {
          history_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          history_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          history_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_history_reads_history_id_fkey"
            columns: ["history_id"]
            isOneToOne: false
            referencedRelation: "order_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_history_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          personalization: Json | null
          product_id: string | null
          product_name: string
          quantity: number
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          personalization?: Json | null
          product_id?: string | null
          product_name: string
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          personalization?: Json | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_labels: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          label: Database["public"]["Enums"]["label_type"]
          order_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          label: Database["public"]["Enums"]["label_type"]
          order_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          label?: Database["public"]["Enums"]["label_type"]
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_labels_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_labels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_watchers: {
        Row: {
          created_at: string
          id: string
          order_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_watchers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_watchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          bling_order_id: number | null
          client_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          description: string | null
          discount_pending_approval: boolean | null
          discount_percentage: number | null
          due_date: string | null
          id: string
          is_personalized: boolean | null
          is_pipeline_managed: boolean
          order_date: string | null
          order_number: number
          order_type: Database["public"]["Enums"]["order_type"]
          origin: string | null
          personalization_data: Json | null
          position: number
          priority: Database["public"]["Enums"]["order_priority"]
          rep_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["order_status"]
          tiny_invoice_id: number | null
          tiny_order_id: number | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          bling_order_id?: number | null
          client_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_pending_approval?: boolean | null
          discount_percentage?: number | null
          due_date?: string | null
          id?: string
          is_personalized?: boolean | null
          is_pipeline_managed?: boolean
          order_date?: string | null
          order_number?: number
          order_type?: Database["public"]["Enums"]["order_type"]
          origin?: string | null
          personalization_data?: Json | null
          position?: number
          priority?: Database["public"]["Enums"]["order_priority"]
          rep_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tiny_invoice_id?: number | null
          tiny_order_id?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          bling_order_id?: number | null
          client_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_pending_approval?: boolean | null
          discount_percentage?: number | null
          due_date?: string | null
          id?: string
          is_personalized?: boolean | null
          is_pipeline_managed?: boolean
          order_date?: string | null
          order_number?: number
          order_type?: Database["public"]["Enums"]["order_type"]
          origin?: string | null
          personalization_data?: Json | null
          position?: number
          priority?: Database["public"]["Enums"]["order_priority"]
          rep_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tiny_invoice_id?: number | null
          tiny_order_id?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allows_custom_color: boolean | null
          available_colors: Json | null
          bling_color_sku_map: Json | null
          bling_sku: string | null
          canvas_height: number | null
          canvas_width: number | null
          category: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          last_stock_sync: string | null
          lead_time_days: number | null
          min_order_qty: number | null
          name: string
          price: number | null
          print_area_image_url: string | null
          product_type: string | null
          stock: number | null
          supplier_code: string | null
          supplier_color_map: Json | null
          supplier_name: string | null
          tiny_code: string | null
          tiny_color_map: Json | null
          tiny_id: number | null
          tiny_stock: number | null
          tiny_synced_at: string | null
          updated_at: string
        }
        Insert: {
          allows_custom_color?: boolean | null
          available_colors?: Json | null
          bling_color_sku_map?: Json | null
          bling_sku?: string | null
          canvas_height?: number | null
          canvas_width?: number | null
          category?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_stock_sync?: string | null
          lead_time_days?: number | null
          min_order_qty?: number | null
          name: string
          price?: number | null
          print_area_image_url?: string | null
          product_type?: string | null
          stock?: number | null
          supplier_code?: string | null
          supplier_color_map?: Json | null
          supplier_name?: string | null
          tiny_code?: string | null
          tiny_color_map?: Json | null
          tiny_id?: number | null
          tiny_stock?: number | null
          tiny_synced_at?: string | null
          updated_at?: string
        }
        Update: {
          allows_custom_color?: boolean | null
          available_colors?: Json | null
          bling_color_sku_map?: Json | null
          bling_sku?: string | null
          canvas_height?: number | null
          canvas_width?: number | null
          category?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_stock_sync?: string | null
          lead_time_days?: number | null
          min_order_qty?: number | null
          name?: string
          price?: number | null
          print_area_image_url?: string | null
          product_type?: string | null
          stock?: number | null
          supplier_code?: string | null
          supplier_color_map?: Json | null
          supplier_name?: string | null
          tiny_code?: string | null
          tiny_color_map?: Json | null
          tiny_id?: number | null
          tiny_stock?: number | null
          tiny_synced_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          failed_login_attempts: number | null
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          locked_until: string | null
          notification_preferences: Json | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          failed_login_attempts?: number | null
          full_name: string
          id: string
          is_active?: boolean
          last_login_at?: string | null
          locked_until?: string | null
          notification_preferences?: Json | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          failed_login_attempts?: number | null
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          locked_until?: string | null
          notification_preferences?: Json | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_quotes: {
        Row: {
          assigned_to: string | null
          client_city: string | null
          client_complement: string | null
          client_document: string | null
          client_email: string | null
          client_logo_url: string | null
          client_name: string
          client_neighborhood: string | null
          client_number: string | null
          client_phone: string | null
          client_social_media: string | null
          client_state: string | null
          client_street: string | null
          client_whatsapp: string | null
          client_zip_code: string | null
          created_at: string
          estimated_value: number | null
          existing_client_id: string | null
          id: string
          internal_notes: string | null
          is_existing_client: boolean | null
          items: Json
          order_id: string | null
          personalization: Json | null
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_city?: string | null
          client_complement?: string | null
          client_document?: string | null
          client_email?: string | null
          client_logo_url?: string | null
          client_name: string
          client_neighborhood?: string | null
          client_number?: string | null
          client_phone?: string | null
          client_social_media?: string | null
          client_state?: string | null
          client_street?: string | null
          client_whatsapp?: string | null
          client_zip_code?: string | null
          created_at?: string
          estimated_value?: number | null
          existing_client_id?: string | null
          id?: string
          internal_notes?: string | null
          is_existing_client?: boolean | null
          items: Json
          order_id?: string | null
          personalization?: Json | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_city?: string | null
          client_complement?: string | null
          client_document?: string | null
          client_email?: string | null
          client_logo_url?: string | null
          client_name?: string
          client_neighborhood?: string | null
          client_number?: string | null
          client_phone?: string | null
          client_social_media?: string | null
          client_state?: string | null
          client_street?: string | null
          client_whatsapp?: string | null
          client_zip_code?: string | null
          created_at?: string
          estimated_value?: number | null
          existing_client_id?: string | null
          id?: string
          internal_notes?: string | null
          is_existing_client?: boolean | null
          items?: Json
          order_id?: string | null
          personalization?: Json | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_quotes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_quotes_existing_client_id_fkey"
            columns: ["existing_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_agreements: {
        Row: {
          agreement_hash: string | null
          agreement_version: string
          created_at: string
          created_by: string | null
          id: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          signed_at: string | null
          signer_document: string | null
          signer_ip: unknown
          signer_name: string | null
          signer_role: string | null
          signer_user_agent: string | null
          status: string
          supplier_id: string
          token: string
          token_expires_at: string
        }
        Insert: {
          agreement_hash?: string | null
          agreement_version?: string
          created_at?: string
          created_by?: string | null
          id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          signed_at?: string | null
          signer_document?: string | null
          signer_ip?: unknown
          signer_name?: string | null
          signer_role?: string | null
          signer_user_agent?: string | null
          status?: string
          supplier_id: string
          token?: string
          token_expires_at: string
        }
        Update: {
          agreement_hash?: string | null
          agreement_version?: string
          created_at?: string
          created_by?: string | null
          id?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          signed_at?: string | null
          signer_document?: string | null
          signer_ip?: unknown
          signer_name?: string | null
          signer_role?: string | null
          signer_user_agent?: string | null
          status?: string
          supplier_id?: string
          token?: string
          token_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_agreements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_agreements_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_agreements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_data_logs: {
        Row: {
          bling_contact_id: number | null
          bling_response: Json | null
          client_id: string | null
          data_sent: Json
          error_message: string | null
          fields_sent: string[]
          id: string
          order_id: string
          sent_at: string
          sent_by: string | null
          status: string
          supplier_id: string
        }
        Insert: {
          bling_contact_id?: number | null
          bling_response?: Json | null
          client_id?: string | null
          data_sent: Json
          error_message?: string | null
          fields_sent: string[]
          id?: string
          order_id: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          supplier_id: string
        }
        Update: {
          bling_contact_id?: number | null
          bling_response?: Json | null
          client_id?: string | null
          data_sent?: Json
          error_message?: string | null
          fields_sent?: string[]
          id?: string
          order_id?: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_data_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_data_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_data_logs_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_data_logs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          activated_at: string | null
          bling_api_token: string | null
          bling_base_url: string | null
          bling_client_id: string | null
          bling_client_secret: string | null
          bling_access_token: string | null
          bling_refresh_token: string | null
          bling_token_expires_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          deactivation_reason: string | null
          id: string
          is_active: boolean
          name: string
          shared_fields: Json
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          bling_api_token?: string | null
          bling_base_url?: string | null
          bling_client_id?: string | null
          bling_client_secret?: string | null
          bling_access_token?: string | null
          bling_refresh_token?: string | null
          bling_token_expires_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivation_reason?: string | null
          id?: string
          is_active?: boolean
          name: string
          shared_fields?: Json
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          bling_api_token?: string | null
          bling_base_url?: string | null
          bling_client_id?: string | null
          bling_client_secret?: string | null
          bling_access_token?: string | null
          bling_refresh_token?: string | null
          bling_token_expires_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          deactivation_reason?: string | null
          id?: string
          is_active?: boolean
          name?: string
          shared_fields?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tiny_webhook_events: {
        Row: {
          event_type: string | null
          forwarded_error: string | null
          forwarded_http_code: number | null
          forwarded_status: string | null
          forwarded_to_ni_at: string | null
          headers: Json | null
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          received_at: string
          source_ip: string | null
          tiny_order_id: number | null
        }
        Insert: {
          event_type?: string | null
          forwarded_error?: string | null
          forwarded_http_code?: number | null
          forwarded_status?: string | null
          forwarded_to_ni_at?: string | null
          headers?: Json | null
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          source_ip?: string | null
          tiny_order_id?: number | null
        }
        Update: {
          event_type?: string | null
          forwarded_error?: string | null
          forwarded_http_code?: number | null
          forwarded_status?: string | null
          forwarded_to_ni_at?: string | null
          headers?: Json | null
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          received_at?: string
          source_ip?: string | null
          tiny_order_id?: number | null
        }
        Relationships: []
      }
      tiny_sync_logs: {
        Row: {
          created_at: string
          direction: string
          entity_id: string | null
          entity_type: string
          error_message: string | null
          id: string
          status: string
          tiny_id: number | null
        }
        Insert: {
          created_at?: string
          direction: string
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          status: string
          tiny_id?: number | null
        }
        Update: {
          created_at?: string
          direction?: string
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          status?: string
          tiny_id?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_client_by_document: {
        Args: { doc_digits: string }
        Returns: {
          city: string | null
          company: string | null
          complement: string | null
          country: string | null
          created_at: string
          created_by: string | null
          document: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          number: string | null
          person_type: Database["public"]["Enums"]["person_type"]
          phone: string | null
          state: string | null
          street: string | null
          tiny_id: number | null
          tiny_synced_at: string | null
          updated_at: string
          zip_code: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_dashboard_clientes_data: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_dashboard_crm: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      order_status_stamps: {
        Args: { p_order_ids: string[] }
        Returns: { order_id: string; entered_status_at: string }[]
      }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_vendas_data: { Args: { p_from: string; p_to: string }; Returns: Json }
      reorder_column: {
        Args: {
          p_order_ids: string[]
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      validate_approval_token: {
        Args: { p_token: string }
        Returns: {
          is_valid: boolean
          is_viewable: boolean
          is_bundle: boolean
          token_id: string
          order_id: string
          artwork_id: string
          order_title: string
          artwork_url: string
          used_at: string | null
          used_by_name: string | null
          artwork_status: string | null
          variation_index: number
          artwork_label: string | null
        }[]
      }
    }
    Enums: {
      artwork_status:
        | "PENDENTE"
        | "APROVADA"
        | "AJUSTE_SOLICITADO"
        | "DESCARTADA"
      audit_action:
        | "LOGIN"
        | "LOGOUT"
        | "CREATE"
        | "UPDATE"
        | "DELETE"
        | "STATUS_CHANGE"
        | "LABEL_CHANGE"
        | "ARTWORK_UPLOAD"
        | "ARTWORK_APPROVE"
        | "ARTWORK_REJECT"
        | "SYNC_TINY"
        | "EXPORT"
      label_type:
        | "BOLETO"
        | "AGUARDANDO_PAGAMENTO"
        | "PEDIDO_CANCELADO"
        | "APROV_AGUARDANDO_PAGAMENTO"
        | "AMOSTRAS"
        | "PAGO"
        | "ORCAMENTO_PUBLICO"
        | "ENTREGUE"
      order_priority: "NORMAL" | "ALTA"
      order_status:
        | "AUTOMATICO"
        | "FAZER"
        | "AJUSTE"
        | "APROVACAO"
        | "LINK_ENVIADO"
        | "AGUARDANDO_APROVACAO"
        | "CONFIRMACAO"
        | "APROVADO"
        | "PRODUCAO"
        | "EXPEDICAO"
        | "FINALIZADO"
        | "ENTREGUE"
        | "FATURADO"
        | "ARQUIVADO"
      order_type:
        | "USUARIO"
        | "PERSONALIZADO"
        | "RUSH"
        | "PROMOCIONAL"
        | "ORCAMENTO_PUBLICO"
      person_type: "FISICA" | "JURIDICA"
      quote_status:
        | "PENDENTE"
        | "CONTACTADO"
        | "CONCLUIDO"
        | "APROVADO"
        | "REJEITADO"
      user_role: "MASTER" | "GESTOR" | "PRESTADOR"
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
      artwork_status: [
        "PENDENTE",
        "APROVADA",
        "AJUSTE_SOLICITADO",
        "DESCARTADA",
      ],
      audit_action: [
        "LOGIN",
        "LOGOUT",
        "CREATE",
        "UPDATE",
        "DELETE",
        "STATUS_CHANGE",
        "LABEL_CHANGE",
        "ARTWORK_UPLOAD",
        "ARTWORK_APPROVE",
        "ARTWORK_REJECT",
        "SYNC_TINY",
        "EXPORT",
      ],
      label_type: [
        "BOLETO",
        "AGUARDANDO_PAGAMENTO",
        "PEDIDO_CANCELADO",
        "APROV_AGUARDANDO_PAGAMENTO",
        "AMOSTRAS",
        "PAGO",
        "ORCAMENTO_PUBLICO",
        "ENTREGUE",
      ],
      order_priority: ["NORMAL", "ALTA"],
      order_status: [
        "AUTOMATICO",
        "FAZER",
        "AJUSTE",
        "APROVACAO",
        "LINK_ENVIADO",
        "AGUARDANDO_APROVACAO",
        "CONFIRMACAO",
        "APROVADO",
        "PRODUCAO",
        "EXPEDICAO",
        "FINALIZADO",
        "ENTREGUE",
        "FATURADO",
        "ARQUIVADO",
      ],
      order_type: [
        "USUARIO",
        "PERSONALIZADO",
        "RUSH",
        "PROMOCIONAL",
        "ORCAMENTO_PUBLICO",
      ],
      person_type: ["FISICA", "JURIDICA"],
      quote_status: [
        "PENDENTE",
        "CONTACTADO",
        "CONCLUIDO",
        "APROVADO",
        "REJEITADO",
      ],
      user_role: ["MASTER", "GESTOR", "PRESTADOR"],
    },
  },
} as const

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Client = Database["public"]["Tables"]["clients"]["Row"]
export type Order = Database["public"]["Tables"]["orders"]["Row"]
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"]
export type OrderLabel = Database["public"]["Tables"]["order_labels"]["Row"]
export type Artwork = Database["public"]["Tables"]["artworks"]["Row"]
export type Comment = Database["public"]["Tables"]["comments"]["Row"]
export type Notification = Database["public"]["Tables"]["notifications"]["Row"]
export type Product = Database["public"]["Tables"]["products"]["Row"]
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"]
export type PublicQuote = Database["public"]["Tables"]["public_quotes"]["Row"]
export type Attachment = Database["public"]["Tables"]["attachments"]["Row"]
export type Checklist = Database["public"]["Tables"]["checklists"]["Row"]
export type ChecklistItem = Database["public"]["Tables"]["checklist_items"]["Row"]
export type OrderHistory = Database["public"]["Tables"]["order_history"]["Row"]
export type ApprovalToken = Database["public"]["Tables"]["approval_tokens"]["Row"]
export type TinySyncLog = Database["public"]["Tables"]["tiny_sync_logs"]["Row"]
export type OrderWatcher = Database["public"]["Tables"]["order_watchers"]["Row"]
export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"]
export type SupplierAgreement = Database["public"]["Tables"]["supplier_agreements"]["Row"]
export type SupplierDataLog = Database["public"]["Tables"]["supplier_data_logs"]["Row"]
export type PushToken = Database["public"]["Tables"]["push_tokens"]["Row"]
