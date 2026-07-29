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
          origin: string | null
          person_type: Database["public"]["Enums"]["person_type"]
          phone: string | null
          sales_channel: Database["public"]["Enums"]["sales_channel"] | null
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
          origin?: string | null
          person_type?: Database["public"]["Enums"]["person_type"]
          phone?: string | null
          sales_channel?: Database["public"]["Enums"]["sales_channel"] | null
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
          origin?: string | null
          person_type?: Database["public"]["Enums"]["person_type"]
          phone?: string | null
          sales_channel?: Database["public"]["Enums"]["sales_channel"] | null
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
      event_credits: {
        Row: {
          client_id: string | null
          created_at: string
          edition_id: string
          id: string
          min_order_qty: number | null
          min_order_value: number | null
          redeemed_at: string | null
          redeemed_order_id: string | null
          registration_id: string
          status: Database["public"]["Enums"]["event_credit_status"]
          type: Database["public"]["Enums"]["event_cashback_type"]
          valid_until: string | null
          value: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          edition_id: string
          id?: string
          min_order_qty?: number | null
          min_order_value?: number | null
          redeemed_at?: string | null
          redeemed_order_id?: string | null
          registration_id: string
          status?: Database["public"]["Enums"]["event_credit_status"]
          type: Database["public"]["Enums"]["event_cashback_type"]
          valid_until?: string | null
          value: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          edition_id?: string
          id?: string
          min_order_qty?: number | null
          min_order_value?: number | null
          redeemed_at?: string | null
          redeemed_order_id?: string | null
          registration_id?: string
          status?: Database["public"]["Enums"]["event_credit_status"]
          type?: Database["public"]["Enums"]["event_cashback_type"]
          valid_until?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_credits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_credits_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "event_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_credits_redeemed_order_id_fkey"
            columns: ["redeemed_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_credits_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_dispatches: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["event_dispatch_channel"]
          created_at: string
          id: string
          recipient: string | null
          registration_id: string
          scheduled_for: string
          send_error: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["event_dispatch_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel?: Database["public"]["Enums"]["event_dispatch_channel"]
          created_at?: string
          id?: string
          recipient?: string | null
          registration_id: string
          scheduled_for?: string
          send_error?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["event_dispatch_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["event_dispatch_channel"]
          created_at?: string
          id?: string
          recipient?: string | null
          registration_id?: string
          scheduled_for?: string
          send_error?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["event_dispatch_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_dispatches_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_editions: {
        Row: {
          cashback_eligibility:
            | Database["public"]["Enums"]["event_cashback_eligibility"]
            | null
          cashback_enabled: boolean
          cashback_min_order_qty: number | null
          cashback_min_order_value: number | null
          cashback_type:
            | Database["public"]["Enums"]["event_cashback_type"]
            | null
          cashback_valid_days: number | null
          cashback_value: number | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          gift_name: string | null
          gift_stock: number | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          raffle_allow_repeat_winners: boolean
          raffle_counter: number
          raffle_eligibility: Database["public"]["Enums"]["event_raffle_eligibility"]
          raffle_enabled: boolean
          raffle_prize: string | null
          slug: string
          starts_at: string | null
          turnstile_enabled: boolean
          updated_at: string
        }
        Insert: {
          cashback_eligibility?:
            | Database["public"]["Enums"]["event_cashback_eligibility"]
            | null
          cashback_enabled?: boolean
          cashback_min_order_qty?: number | null
          cashback_min_order_value?: number | null
          cashback_type?:
            | Database["public"]["Enums"]["event_cashback_type"]
            | null
          cashback_valid_days?: number | null
          cashback_value?: number | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          gift_name?: string | null
          gift_stock?: number | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          raffle_allow_repeat_winners?: boolean
          raffle_counter?: number
          raffle_eligibility?: Database["public"]["Enums"]["event_raffle_eligibility"]
          raffle_enabled?: boolean
          raffle_prize?: string | null
          slug: string
          starts_at?: string | null
          turnstile_enabled?: boolean
          updated_at?: string
        }
        Update: {
          cashback_eligibility?:
            | Database["public"]["Enums"]["event_cashback_eligibility"]
            | null
          cashback_enabled?: boolean
          cashback_min_order_qty?: number | null
          cashback_min_order_value?: number | null
          cashback_type?:
            | Database["public"]["Enums"]["event_cashback_type"]
            | null
          cashback_valid_days?: number | null
          cashback_value?: number | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          gift_name?: string | null
          gift_stock?: number | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          raffle_allow_repeat_winners?: boolean
          raffle_counter?: number
          raffle_eligibility?: Database["public"]["Enums"]["event_raffle_eligibility"]
          raffle_enabled?: boolean
          raffle_prize?: string | null
          slug?: string
          starts_at?: string | null
          turnstile_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_editions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_gift_redemptions: {
        Row: {
          created_at: string
          edition_id: string
          id: string
          redeemed_at: string | null
          redeemed_by: string | null
          registration_id: string
          short_code: string
          status: Database["public"]["Enums"]["event_gift_status"]
          token: string
        }
        Insert: {
          created_at?: string
          edition_id: string
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          registration_id: string
          short_code: string
          status?: Database["public"]["Enums"]["event_gift_status"]
          token?: string
        }
        Update: {
          created_at?: string
          edition_id?: string
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          registration_id?: string
          short_code?: string
          status?: Database["public"]["Enums"]["event_gift_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_gift_redemptions_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "event_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_gift_redemptions_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_gift_redemptions_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_raffle_draws: {
        Row: {
          drawn_at: string
          drawn_by: string | null
          drawn_for_date: string | null
          edition_id: string
          id: string
          pool_size: number | null
          prize: string | null
          raffle_number: number | null
          registration_id: string
        }
        Insert: {
          drawn_at?: string
          drawn_by?: string | null
          drawn_for_date?: string | null
          edition_id: string
          id?: string
          pool_size?: number | null
          prize?: string | null
          raffle_number?: number | null
          registration_id: string
        }
        Update: {
          drawn_at?: string
          drawn_by?: string | null
          drawn_for_date?: string | null
          edition_id?: string
          id?: string
          pool_size?: number | null
          prize?: string | null
          raffle_number?: number | null
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_raffle_draws_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "event_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_raffle_draws_drawn_by_fkey"
            columns: ["drawn_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_raffle_draws_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          consent_at: string | null
          consent_ip_hmac: string | null
          consent_version: string | null
          contact_type: Database["public"]["Enums"]["sales_channel"] | null
          created_at: string
          document: string | null
          edition_id: string
          email: string | null
          id: string
          idempotency_key: string | null
          is_existing_client: boolean
          matched_client_id: string | null
          name: string | null
          phone: string | null
          qualified: boolean
          raffle_number: number | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          consent_at?: string | null
          consent_ip_hmac?: string | null
          consent_version?: string | null
          contact_type?: Database["public"]["Enums"]["sales_channel"] | null
          created_at?: string
          document?: string | null
          edition_id: string
          email?: string | null
          id?: string
          idempotency_key?: string | null
          is_existing_client?: boolean
          matched_client_id?: string | null
          name?: string | null
          phone?: string | null
          qualified?: boolean
          raffle_number?: number | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          consent_at?: string | null
          consent_ip_hmac?: string | null
          consent_version?: string | null
          contact_type?: Database["public"]["Enums"]["sales_channel"] | null
          created_at?: string
          document?: string | null
          edition_id?: string
          email?: string | null
          id?: string
          idempotency_key?: string | null
          is_existing_client?: boolean
          matched_client_id?: string | null
          name?: string | null
          phone?: string | null
          qualified?: boolean
          raffle_number?: number | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "event_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_matched_client_id_fkey"
            columns: ["matched_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          desconto_resultado: boolean
          id: string
          lead_online: boolean
          pedido_sincronizado: boolean
          retornos_hoje: boolean
          updated_at: string
          user_id: string
          vinculo_expirando: boolean
        }
        Insert: {
          created_at?: string
          desconto_resultado?: boolean
          id?: string
          lead_online?: boolean
          pedido_sincronizado?: boolean
          retornos_hoje?: boolean
          updated_at?: string
          user_id: string
          vinculo_expirando?: boolean
        }
        Update: {
          created_at?: string
          desconto_resultado?: boolean
          id?: string
          lead_online?: boolean
          pedido_sincronizado?: boolean
          retornos_hoje?: boolean
          updated_at?: string
          user_id?: string
          vinculo_expirando?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
          push_sent: boolean | null
          push_sent_at: string | null
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
          push_sent?: boolean | null
          push_sent_at?: string | null
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
          push_sent?: boolean | null
          push_sent_at?: string | null
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
      nps_dispatches: {
        Row: {
          channel: Database["public"]["Enums"]["nps_dispatch_channel"]
          client_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          last_reminder_at: string | null
          order_id: string | null
          recipient_email: string | null
          recipient_phone: string | null
          reminders_sent: number
          scheduled_for: string
          send_error: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["nps_dispatch_status"]
          survey_id: string
          token: string
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["nps_dispatch_channel"]
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_reminder_at?: string | null
          order_id?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          reminders_sent?: number
          scheduled_for?: string
          send_error?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["nps_dispatch_status"]
          survey_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["nps_dispatch_channel"]
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_reminder_at?: string | null
          order_id?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          reminders_sent?: number
          scheduled_for?: string
          send_error?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["nps_dispatch_status"]
          survey_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_dispatches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_dispatches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_dispatches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_dispatches_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "nps_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_followups: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          response_id: string
          status: Database["public"]["Enums"]["nps_followup_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_id: string
          status?: Database["public"]["Enums"]["nps_followup_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_id?: string
          status?: Database["public"]["Enums"]["nps_followup_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_followups_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_followups_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_followups_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: true
            referencedRelation: "nps_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_response_tags: {
        Row: {
          created_at: string
          id: string
          response_id: string
          theme: Database["public"]["Enums"]["nps_theme"]
        }
        Insert: {
          created_at?: string
          id?: string
          response_id: string
          theme: Database["public"]["Enums"]["nps_theme"]
        }
        Update: {
          created_at?: string
          id?: string
          response_id?: string
          theme?: Database["public"]["Enums"]["nps_theme"]
        }
        Relationships: [
          {
            foreignKeyName: "nps_response_tags_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "nps_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_responses: {
        Row: {
          allow_contact: boolean
          allow_testimonial: boolean
          category: Database["public"]["Enums"]["nps_category"] | null
          client_id: string | null
          comment: string | null
          created_at: string
          dispatch_id: string
          id: string
          order_id: string | null
          rep_id: string | null
          responded_at: string
          respondent_meta: Json | null
          sales_channel: Database["public"]["Enums"]["sales_channel"] | null
          score: number
          survey_id: string
        }
        Insert: {
          allow_contact?: boolean
          allow_testimonial?: boolean
          category?: Database["public"]["Enums"]["nps_category"] | null
          client_id?: string | null
          comment?: string | null
          created_at?: string
          dispatch_id: string
          id?: string
          order_id?: string | null
          rep_id?: string | null
          responded_at?: string
          respondent_meta?: Json | null
          sales_channel?: Database["public"]["Enums"]["sales_channel"] | null
          score: number
          survey_id: string
        }
        Update: {
          allow_contact?: boolean
          allow_testimonial?: boolean
          category?: Database["public"]["Enums"]["nps_category"] | null
          client_id?: string | null
          comment?: string | null
          created_at?: string
          dispatch_id?: string
          id?: string
          order_id?: string | null
          rep_id?: string | null
          responded_at?: string
          respondent_meta?: Json | null
          sales_channel?: Database["public"]["Enums"]["sales_channel"] | null
          score?: number
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: true
            referencedRelation: "nps_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "nps_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_surveys: {
        Row: {
          cooldown_days: number
          created_at: string
          created_by: string | null
          delay_hours: number
          expires_after_days: number
          fallback_channel:
            | Database["public"]["Enums"]["nps_dispatch_channel"]
            | null
          id: string
          is_active: boolean
          max_reminders: number
          name: string
          primary_channel: Database["public"]["Enums"]["nps_dispatch_channel"]
          question_detractor: string
          question_main: string
          question_passive: string
          question_promoter: string
          reminder_after_hours: number
          sales_channel: Database["public"]["Enums"]["sales_channel"] | null
          trigger_status: Database["public"]["Enums"]["order_status"] | null
          type: Database["public"]["Enums"]["nps_survey_type"]
          updated_at: string
        }
        Insert: {
          cooldown_days?: number
          created_at?: string
          created_by?: string | null
          delay_hours?: number
          expires_after_days?: number
          fallback_channel?:
            | Database["public"]["Enums"]["nps_dispatch_channel"]
            | null
          id?: string
          is_active?: boolean
          max_reminders?: number
          name: string
          primary_channel?: Database["public"]["Enums"]["nps_dispatch_channel"]
          question_detractor?: string
          question_main?: string
          question_passive?: string
          question_promoter?: string
          reminder_after_hours?: number
          sales_channel?: Database["public"]["Enums"]["sales_channel"] | null
          trigger_status?: Database["public"]["Enums"]["order_status"] | null
          type: Database["public"]["Enums"]["nps_survey_type"]
          updated_at?: string
        }
        Update: {
          cooldown_days?: number
          created_at?: string
          created_by?: string | null
          delay_hours?: number
          expires_after_days?: number
          fallback_channel?:
            | Database["public"]["Enums"]["nps_dispatch_channel"]
            | null
          id?: string
          is_active?: boolean
          max_reminders?: number
          name?: string
          primary_channel?: Database["public"]["Enums"]["nps_dispatch_channel"]
          question_detractor?: string
          question_main?: string
          question_passive?: string
          question_promoter?: string
          reminder_after_hours?: number
          sales_channel?: Database["public"]["Enums"]["sales_channel"] | null
          trigger_status?: Database["public"]["Enums"]["order_status"] | null
          type?: Database["public"]["Enums"]["nps_survey_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_surveys_created_by_fkey"
            columns: ["created_by"]
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
          color: string | null
          color_name: string | null
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
          color?: string | null
          color_name?: string | null
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
          color?: string | null
          color_name?: string | null
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
      order_items_backup_20260429120000: {
        Row: {
          backed_up_at: string | null
          color: string | null
          color_name: string | null
          id: string | null
          personalization: Json | null
          product_name: string | null
        }
        Insert: {
          backed_up_at?: string | null
          color?: string | null
          color_name?: string | null
          id?: string | null
          personalization?: Json | null
          product_name?: string | null
        }
        Update: {
          backed_up_at?: string | null
          color?: string | null
          color_name?: string | null
          id?: string | null
          personalization?: Json | null
          product_name?: string | null
        }
        Relationships: []
      }
      order_items_backup_20260513150000: {
        Row: {
          backed_up_at: string | null
          color: string | null
          color_name: string | null
          created_at: string | null
          id: string | null
          order_id: string | null
          personalization: Json | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          backed_up_at?: string | null
          color?: string | null
          color_name?: string | null
          created_at?: string | null
          id?: string | null
          order_id?: string | null
          personalization?: Json | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number | null
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          backed_up_at?: string | null
          color?: string | null
          color_name?: string | null
          created_at?: string | null
          id?: string | null
          order_id?: string | null
          personalization?: Json | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number | null
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          client_id: string | null
          contacted_at: string | null
          contacted_by: string | null
          created_at: string
          email: string | null
          id: string
          last_submitted_at: string
          lead_ref: string | null
          name: string | null
          notes: string | null
          phone: string
          source: string
          status: Database["public"]["Enums"]["lead_status"]
          submissions: number
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          client_id?: string | null
          contacted_at?: string | null
          contacted_by?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_submitted_at?: string
          lead_ref?: string | null
          name?: string | null
          notes?: string | null
          phone: string
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          submissions?: number
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          client_id?: string | null
          contacted_at?: string | null
          contacted_by?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_submitted_at?: string
          lead_ref?: string | null
          name?: string | null
          notes?: string | null
          phone?: string
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          submissions?: number
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      order_labels_backup_20260429140000: {
        Row: {
          backed_up_at: string
          label: Database["public"]["Enums"]["label_type"]
          op: string
          order_id: string
          original_created_at: string | null
          original_id: string | null
        }
        Insert: {
          backed_up_at?: string
          label: Database["public"]["Enums"]["label_type"]
          op: string
          order_id: string
          original_created_at?: string | null
          original_id?: string | null
        }
        Update: {
          backed_up_at?: string
          label?: Database["public"]["Enums"]["label_type"]
          op?: string
          order_id?: string
          original_created_at?: string | null
          original_id?: string | null
        }
        Relationships: []
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
          approval_note: string | null
          archived_at: string | null
          assigned_to: string | null
          bling_order_id: number | null
          card_installments: number | null
          client_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          discount_pending_approval: boolean | null
          discount_percentage: number | null
          due_date: string | null
          id: string
          is_personalized: boolean | null
          is_pipeline_managed: boolean
          meta_capi_sent_at: string | null
          notes: string | null
          order_date: string | null
          order_number: number
          order_type: Database["public"]["Enums"]["order_type"]
          origin: string | null
          payment_terms: Database["public"]["Enums"]["payment_term"] | null
          personalization_data: Json | null
          position: number
          priority: Database["public"]["Enums"]["order_priority"]
          rep_id: string | null
          sales_channel: Database["public"]["Enums"]["sales_channel"] | null
          start_date: string | null
          status: Database["public"]["Enums"]["order_status"]
          tiny_invoice_id: number | null
          tiny_order_id: number | null
          tiny_sync_hash: string | null
          title: string
          updated_at: string
          uses_existing_art: boolean
        }
        Insert: {
          approval_note?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          bling_order_id?: number | null
          card_installments?: number | null
          client_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          discount_pending_approval?: boolean | null
          discount_percentage?: number | null
          due_date?: string | null
          id?: string
          is_personalized?: boolean | null
          is_pipeline_managed?: boolean
          meta_capi_sent_at?: string | null
          notes?: string | null
          order_date?: string | null
          order_number?: number
          order_type?: Database["public"]["Enums"]["order_type"]
          origin?: string | null
          payment_terms?: Database["public"]["Enums"]["payment_term"] | null
          personalization_data?: Json | null
          position?: number
          priority?: Database["public"]["Enums"]["order_priority"]
          rep_id?: string | null
          sales_channel?: Database["public"]["Enums"]["sales_channel"] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tiny_invoice_id?: number | null
          tiny_order_id?: number | null
          tiny_sync_hash?: string | null
          title: string
          updated_at?: string
          uses_existing_art?: boolean
        }
        Update: {
          approval_note?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          bling_order_id?: number | null
          card_installments?: number | null
          client_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          discount_pending_approval?: boolean | null
          discount_percentage?: number | null
          due_date?: string | null
          id?: string
          is_personalized?: boolean | null
          is_pipeline_managed?: boolean
          meta_capi_sent_at?: string | null
          notes?: string | null
          order_date?: string | null
          order_number?: number
          order_type?: Database["public"]["Enums"]["order_type"]
          origin?: string | null
          payment_terms?: Database["public"]["Enums"]["payment_term"] | null
          personalization_data?: Json | null
          position?: number
          priority?: Database["public"]["Enums"]["order_priority"]
          rep_id?: string | null
          sales_channel?: Database["public"]["Enums"]["sales_channel"] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tiny_invoice_id?: number | null
          tiny_order_id?: number | null
          tiny_sync_hash?: string | null
          title?: string
          updated_at?: string
          uses_existing_art?: boolean
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
          {
            foreignKeyName: "orders_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders_canceled_backfill_backup_20260518150000: {
        Row: {
          applied_archived_at: string | null
          backed_up_at: string
          op: string
          order_id: string
          previous_archived_at: string | null
        }
        Insert: {
          applied_archived_at?: string | null
          backed_up_at?: string
          op: string
          order_id: string
          previous_archived_at?: string | null
        }
        Update: {
          applied_archived_at?: string | null
          backed_up_at?: string
          op?: string
          order_id?: string
          previous_archived_at?: string | null
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          avista_discount_pct: number
          id: boolean
          min_order_distribuidora: number
          min_order_varejista: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          avista_discount_pct?: number
          id?: boolean
          min_order_distribuidora?: number
          min_order_varejista?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          avista_discount_pct?: number
          id?: boolean
          min_order_distribuidora?: number
          min_order_varejista?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      pricing_tiers: {
        Row: {
          channel: Database["public"]["Enums"]["sales_channel"]
          created_at: string
          id: string
          is_active: boolean
          min_qty: number
          product_id: string
          unit_price: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["sales_channel"]
          created_at?: string
          id?: string
          is_active?: boolean
          min_qty?: number
          product_id: string
          unit_price: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["sales_channel"]
          created_at?: string
          id?: string
          is_active?: boolean
          min_qty?: number
          product_id?: string
          unit_price?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_volume_discounts: {
        Row: {
          channel: Database["public"]["Enums"]["sales_channel"]
          discount_pct: number
          id: string
          is_active: boolean
          min_order_value: number
        }
        Insert: {
          channel: Database["public"]["Enums"]["sales_channel"]
          discount_pct: number
          id?: string
          is_active?: boolean
          min_order_value: number
        }
        Update: {
          channel?: Database["public"]["Enums"]["sales_channel"]
          discount_pct?: number
          id?: string
          is_active?: boolean
          min_order_value?: number
        }
        Relationships: []
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
          inventory_pools: Database["public"]["Enums"]["supplier_inventory_pool"][]
          inventory_supplier_id: string | null
          is_active: boolean
          last_stock_sync: string | null
          lead_time_days: number | null
          min_order_qty: number | null
          name: string
          price: number | null
          product_type: string | null
          stock: number | null
          supplier_code: string | null
          supplier_name: string | null
          tiny_code: string | null
          tiny_color_map: Json | null
          tiny_deposito_marketplace_id: number | null
          tiny_deposito_personalizado_id: number | null
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
          inventory_pools?: Database["public"]["Enums"]["supplier_inventory_pool"][]
          inventory_supplier_id?: string | null
          is_active?: boolean
          last_stock_sync?: string | null
          lead_time_days?: number | null
          min_order_qty?: number | null
          name: string
          price?: number | null
          product_type?: string | null
          stock?: number | null
          supplier_code?: string | null
          supplier_name?: string | null
          tiny_code?: string | null
          tiny_color_map?: Json | null
          tiny_deposito_marketplace_id?: number | null
          tiny_deposito_personalizado_id?: number | null
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
          inventory_pools?: Database["public"]["Enums"]["supplier_inventory_pool"][]
          inventory_supplier_id?: string | null
          is_active?: boolean
          last_stock_sync?: string | null
          lead_time_days?: number | null
          min_order_qty?: number | null
          name?: string
          price?: number | null
          product_type?: string | null
          stock?: number | null
          supplier_code?: string | null
          supplier_name?: string | null
          tiny_code?: string | null
          tiny_color_map?: Json | null
          tiny_deposito_marketplace_id?: number | null
          tiny_deposito_personalizado_id?: number | null
          tiny_id?: number | null
          tiny_stock?: number | null
          tiny_synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_inventory_supplier_id_fkey"
            columns: ["inventory_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          commission_rate: number | null
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
          tiny_vendedor_id: number | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          commission_rate?: number | null
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
          tiny_vendedor_id?: number | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          commission_rate?: number | null
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
          tiny_vendedor_id?: number | null
          updated_at?: string
        }
        Relationships: []
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
          meta_capi_sent_at: string | null
          order_id: string | null
          personalization: Json | null
          rep_id: string | null
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
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
          meta_capi_sent_at?: string | null
          order_id?: string | null
          personalization?: Json | null
          rep_id?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
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
          meta_capi_sent_at?: string | null
          order_id?: string | null
          personalization?: Json | null
          rep_id?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
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
          {
            foreignKeyName: "public_quotes_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          platform?: string
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
      rep_activity_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          rep_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          rep_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          rep_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_activity_log_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_client_links: {
        Row: {
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          last_visit_at: string | null
          linked_at: string
          origin: string
          rep_id: string
          status: string
          visit_deadline_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_visit_at?: string | null
          linked_at?: string
          origin: string
          rep_id: string
          status?: string
          visit_deadline_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_visit_at?: string | null
          linked_at?: string
          origin?: string
          rep_id?: string
          status?: string
          visit_deadline_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rep_client_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_client_links_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_goals: {
        Row: {
          created_at: string
          id: string
          month: string
          notes: string | null
          rep_id: string
          target_orders: number | null
          target_value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          notes?: string | null
          rep_id: string
          target_orders?: number | null
          target_value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          notes?: string | null
          rep_id?: string
          target_orders?: number | null
          target_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rep_goals_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_interactions: {
        Row: {
          client_id: string | null
          created_at: string
          direction: string
          duration_seconds: number | null
          id: string
          notes: string | null
          outcome: string | null
          prospect_id: string | null
          rep_id: string
          type: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          outcome?: string | null
          prospect_id?: string | null
          rep_id: string
          type: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          outcome?: string | null
          prospect_id?: string | null
          rep_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_interactions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "rep_prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_interactions_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_lead_rules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          match_field: string
          match_operator: string
          match_value: string
          name: string
          route_type: string
          target_rep_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          match_field: string
          match_operator?: string
          match_value: string
          name: string
          route_type?: string
          target_rep_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          match_field?: string
          match_operator?: string
          match_value?: string
          name?: string
          route_type?: string
          target_rep_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_lead_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_lead_rules_target_rep_id_fkey"
            columns: ["target_rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_prospects: {
        Row: {
          address: string | null
          cep: string | null
          city: string | null
          client_id: string | null
          contact_count: number | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          last_contact_at: string | null
          last_contact_type: string | null
          name: string
          notes: string | null
          origin: string
          phone: string | null
          position: number
          rep_id: string
          return_date: string | null
          scheduled_action: string | null
          scheduled_time: string | null
          segment: string | null
          state: string | null
          status: string
          tiny_contact_id: number | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          address?: string | null
          cep?: string | null
          city?: string | null
          client_id?: string | null
          contact_count?: number | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          last_contact_at?: string | null
          last_contact_type?: string | null
          name: string
          notes?: string | null
          origin?: string
          phone?: string | null
          position?: number
          rep_id: string
          return_date?: string | null
          scheduled_action?: string | null
          scheduled_time?: string | null
          segment?: string | null
          state?: string | null
          status?: string
          tiny_contact_id?: number | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          address?: string | null
          cep?: string | null
          city?: string | null
          client_id?: string | null
          contact_count?: number | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          last_contact_at?: string | null
          last_contact_type?: string | null
          name?: string
          notes?: string | null
          origin?: string
          phone?: string | null
          position?: number
          rep_id?: string
          return_date?: string | null
          scheduled_action?: string | null
          scheduled_time?: string | null
          segment?: string | null
          state?: string | null
          status?: string
          tiny_contact_id?: number | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rep_prospects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_prospects_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_territories: {
        Row: {
          city: string
          created_at: string
          id: string
          rep_id: string
          state: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          rep_id: string
          state?: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          rep_id?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_territories_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_visits: {
        Row: {
          address_detected: string | null
          checked_in_at: string
          checked_out_at: string | null
          client_id: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          prospect_id: string | null
          rep_id: string
          result: string
          return_date: string | null
          synced_at: string | null
          visit_type: string
        }
        Insert: {
          address_detected?: string | null
          checked_in_at?: string
          checked_out_at?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          prospect_id?: string | null
          rep_id: string
          result: string
          return_date?: string | null
          synced_at?: string | null
          visit_type: string
        }
        Update: {
          address_detected?: string | null
          checked_in_at?: string
          checked_out_at?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          prospect_id?: string | null
          rep_id?: string
          result?: string
          return_date?: string | null
          synced_at?: string | null
          visit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_visits_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "rep_prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_visits_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      supplier_inventories: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          reference_month: string
          rejected_reason: string | null
          source: string
          status: Database["public"]["Enums"]["supplier_inventory_status"]
          submitted_at: string | null
          submitted_by: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          reference_month: string
          rejected_reason?: string | null
          source?: string
          status?: Database["public"]["Enums"]["supplier_inventory_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          reference_month?: string
          rejected_reason?: string | null
          source?: string
          status?: Database["public"]["Enums"]["supplier_inventory_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_inventories_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_inventories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_inventories_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_inventories_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_inventory_items: {
        Row: {
          color_key: string | null
          created_at: string
          divergence_status: string | null
          id: string
          inventory_id: string
          notes: string | null
          pool: Database["public"]["Enums"]["supplier_inventory_pool"]
          product_id: string
          quantity_balance: number | null
          quantity_committed: number
          quantity_declared: number
          tiny_quantity: number | null
          tiny_synced_at: string | null
          updated_at: string
        }
        Insert: {
          color_key?: string | null
          created_at?: string
          divergence_status?: string | null
          id?: string
          inventory_id: string
          notes?: string | null
          pool: Database["public"]["Enums"]["supplier_inventory_pool"]
          product_id: string
          quantity_balance?: number | null
          quantity_committed?: number
          quantity_declared?: number
          tiny_quantity?: number | null
          tiny_synced_at?: string | null
          updated_at?: string
        }
        Update: {
          color_key?: string | null
          created_at?: string
          divergence_status?: string | null
          id?: string
          inventory_id?: string
          notes?: string | null
          pool?: Database["public"]["Enums"]["supplier_inventory_pool"]
          product_id?: string
          quantity_balance?: number | null
          quantity_committed?: number
          quantity_declared?: number
          tiny_quantity?: number | null
          tiny_synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_inventory_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "supplier_inventories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          activated_at: string | null
          bling_access_token: string | null
          bling_api_token: string | null
          bling_base_url: string | null
          bling_client_id: string | null
          bling_client_secret: string | null
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
          inventory_config: Json
          is_active: boolean
          name: string
          only_mapped_products: boolean
          shared_fields: Json
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          bling_access_token?: string | null
          bling_api_token?: string | null
          bling_base_url?: string | null
          bling_client_id?: string | null
          bling_client_secret?: string | null
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
          inventory_config?: Json
          is_active?: boolean
          name: string
          only_mapped_products?: boolean
          shared_fields?: Json
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          bling_access_token?: string | null
          bling_api_token?: string | null
          bling_base_url?: string | null
          bling_client_id?: string | null
          bling_client_secret?: string | null
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
          inventory_config?: Json
          is_active?: boolean
          name?: string
          only_mapped_products?: boolean
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
      tiny_contact_sync_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          payload: Json | null
          registration_id: string
          status: Database["public"]["Enums"]["tiny_sync_job_status"]
          tiny_id: number | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json | null
          registration_id: string
          status?: Database["public"]["Enums"]["tiny_sync_job_status"]
          tiny_id?: number | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json | null
          registration_id?: string
          status?: Database["public"]["Enums"]["tiny_sync_job_status"]
          tiny_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiny_contact_sync_jobs_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      tiny_depositos: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id: number
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: number
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiny_depositos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_raffle_number: {
        Args: { p_registration_id: string }
        Returns: number
      }
      classify_inventory_divergence: {
        Args: {
          p_committed: number
          p_declared: number
          p_threshold_pct: number
          p_tiny: number
        }
        Returns: string
      }
      compute_supplier_committed: {
        Args: { p_supplier_id: string }
        Returns: {
          color_key: string
          committed: number
          product_id: string
        }[]
      }
      congress_queue_counts: {
        Args: never
        Returns: {
          dispatch_cancelado: number
          dispatch_enviado: number
          dispatch_falhou: number
          dispatch_pendente: number
          sync_dead: number
          sync_done: number
          sync_failed: number
          sync_pending: number
          sync_processing: number
        }[]
      }
      expire_rep_links: { Args: never; Returns: number }
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
          origin: string | null
          person_type: Database["public"]["Enums"]["person_type"]
          phone: string | null
          sales_channel: Database["public"]["Enums"]["sales_channel"] | null
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
      generate_daily_rep_alerts: { Args: never; Returns: Json }
      get_dashboard_clientes_data: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_dashboard_crm: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_vendas_data: { Args: { p_from: string; p_to: string }; Returns: Json }
      move_order_atomic: {
        Args: {
          p_new_position: number
          p_new_status: Database["public"]["Enums"]["order_status"]
          p_order_id: string
        }
        Returns: undefined
      }
      nps_run_relational_wave: {
        Args: { p_dry_run?: boolean; p_survey_id: string }
        Returns: number
      }
      order_status_stamps: {
        Args: { p_order_ids: string[] }
        Returns: {
          entered_status_at: string
          order_id: string
        }[]
      }
      recompute_supplier_inventory: {
        Args: { p_inventory_id: string }
        Returns: undefined
      }
      raffle_draw: {
        Args: { p_edition_id: string; p_for_date?: string }
        Returns: {
          outcome: string
          participant_name: string
          pool_size: number
          raffle_number: number
          registration_id: string
          success: boolean
        }[]
      }
      redeem_gift: {
        Args: { p_token: string }
        Returns: {
          outcome: string
          redeemed_at: string
          redeemed_by_name: string
          success: boolean
        }[]
      }
      reorder_after_remove: {
        Args: {
          p_removed_position: number
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      reorder_before_insert: {
        Args: {
          p_exclude_order_id: string
          p_insert_position: number
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      reorder_column: {
        Args: {
          p_order_ids: string[]
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_nps_response: {
        Args: {
          p_allow_contact?: boolean
          p_allow_testimonial?: boolean
          p_comment?: string
          p_meta?: Json
          p_score: number
          p_themes?: Database["public"]["Enums"]["nps_theme"][]
          p_token: string
        }
        Returns: {
          category: Database["public"]["Enums"]["nps_category"]
          message: string
          ok: boolean
        }[]
      }
      validate_approval_token: {
        Args: { p_token: string }
        Returns: {
          artwork_id: string
          artwork_label: string
          artwork_status: string
          artwork_url: string
          is_bundle: boolean
          is_valid: boolean
          is_viewable: boolean
          order_id: string
          order_title: string
          token_id: string
          used_at: string
          used_by_name: string
          variation_index: number
        }[]
      }
      validate_gift_token: {
        Args: { p_token: string }
        Returns: {
          already_redeemed: boolean
          edition_name: string
          gift_name: string
          is_canceled: boolean
          is_valid: boolean
          participant_first_name: string
          short_code: string
        }[]
      }
      validate_nps_token: {
        Args: { p_token: string }
        Returns: {
          already_responded: boolean
          client_name: string
          dispatch_id: string
          is_expired: boolean
          is_valid: boolean
          order_title: string
          question_detractor: string
          question_main: string
          question_passive: string
          question_promoter: string
          survey_id: string
          survey_type: Database["public"]["Enums"]["nps_survey_type"]
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
      event_cashback_eligibility: "ALL" | "NEW_ONLY"
      event_cashback_type: "PERCENT" | "FIXED"
      event_credit_status: "ATIVO" | "USADO" | "EXPIRADO" | "CANCELADO"
      event_dispatch_channel: "EMAIL" | "WHATSAPP"
      event_dispatch_status: "PENDENTE" | "ENVIADO" | "FALHOU" | "CANCELADO"
      event_gift_status: "PENDENTE" | "RETIRADO" | "CANCELADO"
      event_raffle_eligibility: "ALL" | "QUALIFIED" | "GIFT_REDEEMED"
      label_type:
        | "BOLETO"
        | "AGUARDANDO_PAGAMENTO"
        | "PEDIDO_CANCELADO"
        | "APROV_AGUARDANDO_PAGAMENTO"
        | "AMOSTRAS"
        | "PAGO"
        | "ORCAMENTO_PUBLICO"
        | "LINK_ENVIADO"
        | "ENTREGUE"
        | "ARTE_APROVADA"
        | "ATENCAO"
      nps_category: "DETRATOR" | "PASSIVO" | "PROMOTOR"
      nps_dispatch_channel: "EMAIL" | "WHATSAPP"
      nps_dispatch_status:
        | "PENDENTE"
        | "ENVIADO"
        | "RESPONDIDO"
        | "EXPIRADO"
        | "FALHOU"
        | "CANCELADO"
      nps_followup_status:
        | "ABERTO"
        | "EM_TRATATIVA"
        | "RESOLVIDO"
        | "DISPENSADO"
      nps_survey_type: "TRANSACIONAL" | "RELACIONAL"
      nps_theme:
        | "ATENDIMENTO"
        | "PRAZO_ENTREGA"
        | "QUALIDADE_ARTE"
        | "QUALIDADE_PRODUTO"
        | "PRECO"
        | "COMUNICACAO"
        | "FACILIDADE_COMPRA"
        | "POS_VENDA"
        | "OUTRO"
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
      lead_status: "NOVO" | "CONTATADO" | "CONVERTIDO" | "DESCARTADO"
      payment_term: "PIX_AVISTA" | "CARTAO" | "APROVACAO_ADDS"
      person_type: "FISICA" | "JURIDICA"
      quote_status:
        | "PENDENTE"
        | "CONTACTADO"
        | "CONCLUIDO"
        | "APROVADO"
        | "REJEITADO"
      sales_channel: "CONSUMIDOR" | "DENTISTA" | "DISTRIBUIDORA" | "VAREJISTA"
      supplier_inventory_pool: "PERSONALIZADO" | "MARKETPLACE"
      supplier_inventory_status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED"
      tiny_sync_job_status:
        | "PENDING"
        | "PROCESSING"
        | "DONE"
        | "FAILED"
        | "DEAD"
      user_role: "MASTER" | "GESTOR" | "PRESTADOR" | "REPRESENTANTE"
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
      event_cashback_eligibility: ["ALL", "NEW_ONLY"],
      event_cashback_type: ["PERCENT", "FIXED"],
      event_credit_status: ["ATIVO", "USADO", "EXPIRADO", "CANCELADO"],
      event_dispatch_channel: ["EMAIL", "WHATSAPP"],
      event_dispatch_status: ["PENDENTE", "ENVIADO", "FALHOU", "CANCELADO"],
      event_gift_status: ["PENDENTE", "RETIRADO", "CANCELADO"],
      event_raffle_eligibility: ["ALL", "QUALIFIED", "GIFT_REDEEMED"],
      label_type: [
        "BOLETO",
        "AGUARDANDO_PAGAMENTO",
        "PEDIDO_CANCELADO",
        "APROV_AGUARDANDO_PAGAMENTO",
        "AMOSTRAS",
        "PAGO",
        "ORCAMENTO_PUBLICO",
        "LINK_ENVIADO",
        "ENTREGUE",
        "ARTE_APROVADA",
        "ATENCAO",
      ],
      nps_category: ["DETRATOR", "PASSIVO", "PROMOTOR"],
      nps_dispatch_channel: ["EMAIL", "WHATSAPP"],
      nps_dispatch_status: [
        "PENDENTE",
        "ENVIADO",
        "RESPONDIDO",
        "EXPIRADO",
        "FALHOU",
        "CANCELADO",
      ],
      nps_followup_status: [
        "ABERTO",
        "EM_TRATATIVA",
        "RESOLVIDO",
        "DISPENSADO",
      ],
      nps_survey_type: ["TRANSACIONAL", "RELACIONAL"],
      nps_theme: [
        "ATENDIMENTO",
        "PRAZO_ENTREGA",
        "QUALIDADE_ARTE",
        "QUALIDADE_PRODUTO",
        "PRECO",
        "COMUNICACAO",
        "FACILIDADE_COMPRA",
        "POS_VENDA",
        "OUTRO",
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
      lead_status: ["NOVO", "CONTATADO", "CONVERTIDO", "DESCARTADO"],
      payment_term: ["PIX_AVISTA", "CARTAO", "APROVACAO_ADDS"],
      person_type: ["FISICA", "JURIDICA"],
      quote_status: [
        "PENDENTE",
        "CONTACTADO",
        "CONCLUIDO",
        "APROVADO",
        "REJEITADO",
      ],
      sales_channel: ["CONSUMIDOR", "DENTISTA", "DISTRIBUIDORA", "VAREJISTA"],
      supplier_inventory_pool: ["PERSONALIZADO", "MARKETPLACE"],
      supplier_inventory_status: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
      tiny_sync_job_status: ["PENDING", "PROCESSING", "DONE", "FAILED", "DEAD"],
      user_role: ["MASTER", "GESTOR", "PRESTADOR", "REPRESENTANTE"],
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
export type EventEdition = Database["public"]["Tables"]["event_editions"]["Row"]
