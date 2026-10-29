export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      business_problems: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          description: string
          estimated_duration_days: number
          expected_outcome: string
          extra: NonNullable<Json>
          id: string
          review_expires_at: string
          review_note: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          review_submitted_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          search_tsv: unknown
          solve_status: Database["public"]["Enums"]["solve_status"]
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          description: string
          estimated_duration_days: number
          expected_outcome: string
          extra?: NonNullable<Json>
          id?: string
          review_expires_at?: string
          review_note?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          review_submitted_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_tsv?: never
          solve_status?: Database["public"]["Enums"]["solve_status"]
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          estimated_duration_days?: number
          expected_outcome?: string
          extra?: NonNullable<Json>
          id?: string
          review_expires_at?: string
          review_note?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          review_submitted_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_tsv?: never
          solve_status?: Database["public"]["Enums"]["solve_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_problems_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_problems_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          contact_email: string
          created_at: string
          description: string | null
          id: string
          industry: string
          logo_url: string | null
          name: string
          owner_id: string
          phone: string
          size_range: string | null
          updated_at: string
          website: string | null
        }
        ComputedFields: never
        Insert: {
          address?: string | null
          contact_email: string
          created_at?: string
          description?: string | null
          id?: string
          industry: string
          logo_url?: string | null
          name: string
          owner_id: string
          phone: string
          size_range?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string
          created_at?: string
          description?: string | null
          id?: string
          industry?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string
          size_range?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_attachments: {
        Row: {
          connection_id: string
          created_at: string
          external_url: string | null
          file_name: string | null
          id: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          mime_type: string | null
          size_bytes: number | null
          storage_path: string | null
          uploaded_by: string
        }
        ComputedFields: never
        Insert: {
          connection_id: string
          created_at?: string
          external_url?: string | null
          file_name?: string | null
          id?: string
          kind: Database["public"]["Enums"]["attachment_kind"]
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          external_url?: string | null
          file_name?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["attachment_kind"]
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_attachments_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connection_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_attachments_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "v_connection_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_attachments_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "v_team_engagements"
            referencedColumns: ["connection_id"]
          },
          {
            foreignKeyName: "connection_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_extensions: {
        Row: {
          connection_id: string
          created_at: string
          id: string
          new_end_at: string
          previous_end_at: string
          reason: string | null
          requested_by: string
        }
        ComputedFields: never
        Insert: {
          connection_id: string
          created_at?: string
          id?: string
          new_end_at: string
          previous_end_at: string
          reason?: string | null
          requested_by: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          id?: string
          new_end_at?: string
          previous_end_at?: string
          reason?: string | null
          requested_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_extensions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connection_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_extensions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "v_connection_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_extensions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "v_team_engagements"
            referencedColumns: ["connection_id"]
          },
          {
            foreignKeyName: "connection_extensions_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_participants: {
        Row: {
          connection_id: string
          invited_by: string
          notified_at: string | null
          participant_role: string
          profile_id: string
        }
        ComputedFields: never
        Insert: {
          connection_id: string
          invited_by: string
          notified_at?: string | null
          participant_role: string
          profile_id: string
        }
        Update: {
          connection_id?: string
          invited_by?: string
          notified_at?: string | null
          participant_role?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_participants_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connection_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_participants_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "v_connection_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_participants_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "v_team_engagements"
            referencedColumns: ["connection_id"]
          },
          {
            foreignKeyName: "connection_participants_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_requests: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["request_direction"]
          end_feedback: string | null
          end_rating: number | null
          end_reason: string | null
          ended_at: string | null
          expected_end_at: string | null
          expires_at: string
          id: string
          item_id: string | null
          message: string | null
          problem_id: string
          reminder_sent_at: string | null
          requested_by: string
          responded_at: string | null
          responded_by: string | null
          response_message: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["connection_status"]
          team_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          direction: Database["public"]["Enums"]["request_direction"]
          end_feedback?: string | null
          end_rating?: number | null
          end_reason?: string | null
          ended_at?: string | null
          expected_end_at?: string | null
          expires_at: string
          id?: string
          item_id?: string | null
          message?: string | null
          problem_id: string
          reminder_sent_at?: string | null
          requested_by: string
          responded_at?: string | null
          responded_by?: string | null
          response_message?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["request_direction"]
          end_feedback?: string | null
          end_rating?: number | null
          end_reason?: string | null
          ended_at?: string | null
          expected_end_at?: string | null
          expires_at?: string
          id?: string
          item_id?: string | null
          message?: string | null
          problem_id?: string
          reminder_sent_at?: string | null
          requested_by?: string
          responded_at?: string | null
          responded_by?: string | null
          response_message?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["connection_status"]
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_requests_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "business_problems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "student_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cr_item"
            columns: ["item_id", "team_id"]
            isOneToOne: false
            referencedRelation: "portfolio_items"
            referencedColumns: ["id", "team_id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          is_default: boolean
          kind: Database["public"]["Enums"]["template_kind"]
          name: string
          owner_id: string
          subject: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_default?: boolean
          kind: Database["public"]["Enums"]["template_kind"]
          name: string
          owner_id: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["template_kind"]
          name?: string
          owner_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_members: {
        Row: {
          item_id: string
          profile_id: string
          role_label: string | null
          team_id: string
        }
        ComputedFields: never
        Insert: {
          item_id: string
          profile_id: string
          role_label?: string | null
          team_id: string
        }
        Update: {
          item_id?: string
          profile_id?: string
          role_label?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_im_item"
            columns: ["item_id", "team_id"]
            isOneToOne: false
            referencedRelation: "portfolio_items"
            referencedColumns: ["id", "team_id"]
          },
          {
            foreignKeyName: "fk_im_member"
            columns: ["team_id", "profile_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["team_id", "profile_id"]
          },
        ]
      }
      item_tags: {
        Row: {
          item_id: string
          tag_id: number
        }
        ComputedFields: never
        Insert: {
          item_id: string
          tag_id: number
        }
        Update: {
          item_id?: string
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_tags_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "portfolio_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "v_field_interest"
            referencedColumns: ["tag_id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          connection_id: string | null
          created_at: string
          email_attempts: number
          email_error: string | null
          email_sent_at: string | null
          email_status: Database["public"]["Enums"]["email_status"]
          id: string
          link_path: string | null
          payload: NonNullable<Json>
          read_at: string | null
          recipient_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        ComputedFields: never
        Insert: {
          body?: string | null
          connection_id?: string | null
          created_at?: string
          email_attempts?: number
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: Database["public"]["Enums"]["email_status"]
          id?: string
          link_path?: string | null
          payload?: NonNullable<Json>
          read_at?: string | null
          recipient_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          body?: string | null
          connection_id?: string | null
          created_at?: string
          email_attempts?: number
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: Database["public"]["Enums"]["email_status"]
          id?: string
          link_path?: string | null
          payload?: NonNullable<Json>
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connection_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "v_connection_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "v_team_engagements"
            referencedColumns: ["connection_id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          advisor_id: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          finished_on: string | null
          id: string
          kind: Database["public"]["Enums"]["item_kind"]
          paper_application: string | null
          parent_id: string | null
          review_expires_at: string
          review_note: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          review_submitted_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          search_tsv: unknown
          source_url: string
          started_on: string | null
          summary: string
          team_id: string
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          advisor_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          finished_on?: string | null
          id?: string
          kind: Database["public"]["Enums"]["item_kind"]
          paper_application?: string | null
          parent_id?: string | null
          review_expires_at?: string
          review_note?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          review_submitted_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_tsv?: never
          source_url: string
          started_on?: string | null
          summary: string
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          advisor_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          finished_on?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["item_kind"]
          paper_application?: string | null
          parent_id?: string | null
          review_expires_at?: string
          review_note?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          review_submitted_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          search_tsv?: never
          source_url?: string
          started_on?: string | null
          summary?: string
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_items_parent"
            columns: ["parent_id", "team_id"]
            isOneToOne: false
            referencedRelation: "portfolio_items"
            referencedColumns: ["id", "team_id"]
          },
          {
            foreignKeyName: "portfolio_items_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_items_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_items_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "student_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_tags: {
        Row: {
          problem_id: string
          tag_id: number
        }
        ComputedFields: never
        Insert: {
          problem_id: string
          tag_id: number
        }
        Update: {
          problem_id?: string
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "problem_tags_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "business_problems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problem_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "problem_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "v_field_interest"
            referencedColumns: ["tag_id"]
          },
        ]
      }
      profile_contacts: {
        Row: {
          email: string | null
          other_url: string | null
          phone: string | null
          profile_id: string
          updated_at: string
          zalo: string | null
        }
        ComputedFields: never
        Insert: {
          email?: string | null
          other_url?: string | null
          phone?: string | null
          profile_id: string
          updated_at?: string
          zalo?: string | null
        }
        Update: {
          email?: string | null
          other_url?: string | null
          phone?: string | null
          profile_id?: string
          updated_at?: string
          zalo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cohort: string | null
          created_at: string
          email: string | null
          full_name: string
          headline: string | null
          id: string
          is_active: boolean
          major: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cohort?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          headline?: string | null
          id: string
          is_active?: boolean
          major?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cohort?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          headline?: string | null
          id?: string
          is_active?: boolean
          major?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          from_status: string | null
          id: number
          note: string | null
          to_status: string
        }
        ComputedFields: never
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          from_status?: string | null
          id?: never
          note?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          from_status?: string | null
          id?: never
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_teams: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: NonNullable<Json>
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: NonNullable<Json>
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          is_active: boolean
          kind: Database["public"]["Enums"]["tag_kind"]
          name: string
          slug: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: never
          is_active?: boolean
          kind: Database["public"]["Enums"]["tag_kind"]
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: never
          is_active?: boolean
          kind?: Database["public"]["Enums"]["tag_kind"]
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          joined_at: string
          member_role: Database["public"]["Enums"]["team_role"]
          profile_id: string
          team_id: string
        }
        ComputedFields: never
        Insert: {
          joined_at?: string
          member_role?: Database["public"]["Enums"]["team_role"]
          profile_id: string
          team_id: string
        }
        Update: {
          joined_at?: string
          member_role?: Database["public"]["Enums"]["team_role"]
          profile_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "student_teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_connection_dashboard: {
        Row: {
          company_id: string | null
          company_name: string | null
          created_at: string | null
          direction: Database["public"]["Enums"]["request_direction"] | null
          ended_at: string | null
          execution_days: number | null
          expected_end_at: string | null
          expires_at: string | null
          id: string | null
          is_overdue: boolean | null
          item_id: string | null
          item_title: string | null
          problem_id: string | null
          problem_title: string | null
          requested_by: string | null
          responded_at: string | null
          response_days: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["connection_status"] | null
          team_id: string | null
          team_name: string | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "business_problems_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "business_problems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "student_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cr_item"
            columns: ["item_id", "team_id"]
            isOneToOne: false
            referencedRelation: "portfolio_items"
            referencedColumns: ["id", "team_id"]
          },
        ]
      }
      v_field_interest: {
        Row: {
          approved_problems: number | null
          company_initiated_requests: number | null
          field_name: string | null
          tag_id: number | null
        }
        ComputedFields: never
        Relationships: []
      }
      v_moderation_queue: {
        Row: {
          entity_id: string | null
          entity_type: string | null
          expires_at: string | null
          owner_name: string | null
          sub_type: string | null
          submitted_at: string | null
          title: string | null
        }
        ComputedFields: never
        Relationships: []
      }
      v_team_engagements: {
        Row: {
          company_name: string | null
          connection_id: string | null
          end_feedback: string | null
          end_rating: number | null
          end_reason: string | null
          ended_at: string | null
          problem_title: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["connection_status"] | null
          team_id: string | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "connection_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "student_teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      rpc_admin_set_active: {
        Args: { p_active: boolean; p_user: string }
        Returns: undefined
      }
      rpc_admin_set_role: {
        Args: {
          p_role: Database["public"]["Enums"]["user_role"]
          p_user: string
        }
        Returns: undefined
      }
      rpc_create_connection_request: {
        Args: {
          p_item: string
          p_message: string
          p_problem: string
          p_team: string
          p_ttl_days: number
        }
        Returns: string
      }
      rpc_end_connection: {
        Args: {
          p_feedback: string
          p_id: string
          p_outcome: string
          p_rating: number
          p_reason: string
        }
        Returns: undefined
      }
      rpc_extend_connection: {
        Args: { p_id: string; p_new_end: string; p_reason: string }
        Returns: undefined
      }
      rpc_respond_connection: {
        Args: { p_accept: boolean; p_id: string; p_message: string }
        Returns: undefined
      }
      rpc_resubmit_content: {
        Args: { p_entity: string; p_id: string }
        Returns: undefined
      }
      rpc_search_students: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          avatar_url: string
          cohort: string
          full_name: string
          id: string
          major: string
        }[]
      }
      rpc_soft_delete_content: {
        Args: { p_entity: string; p_id: string }
        Returns: undefined
      }
      rpc_submit_review: {
        Args: {
          p_approve: boolean
          p_entity: string
          p_id: string
          p_note: string
        }
        Returns: undefined
      }
      rpc_transfer_team_leader: {
        Args: { p_new_leader: string; p_team: string }
        Returns: undefined
      }
    }
    Enums: {
      attachment_kind: "proposal" | "deliverable"
      connection_status:
        | "pending"
        | "expired"
        | "rejected"
        | "in_progress"
        | "cancelled"
        | "completed"
      email_status: "not_required" | "pending" | "sent" | "failed"
      item_kind: "project" | "product" | "paper"
      notification_type:
        | "review_approved"
        | "review_rejected"
        | "review_expired"
        | "connection_received"
        | "connection_accepted"
        | "connection_rejected"
        | "connection_expired"
        | "connection_cancelled"
        | "connection_completed"
        | "connection_extended"
        | "connection_overdue_reminder"
        | "system"
      request_direction: "team_to_company" | "company_to_team"
      review_status: "pending_review" | "approved" | "rejected" | "expired"
      solve_status: "open" | "in_progress" | "solved"
      tag_kind: "field" | "skill"
      team_role: "leader" | "member"
      template_kind: "accept" | "reject"
      user_role: "student" | "company" | "lecturer" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      attachment_kind: ["proposal", "deliverable"],
      connection_status: [
        "pending",
        "expired",
        "rejected",
        "in_progress",
        "cancelled",
        "completed",
      ],
      email_status: ["not_required", "pending", "sent", "failed"],
      item_kind: ["project", "product", "paper"],
      notification_type: [
        "review_approved",
        "review_rejected",
        "review_expired",
        "connection_received",
        "connection_accepted",
        "connection_rejected",
        "connection_expired",
        "connection_cancelled",
        "connection_completed",
        "connection_extended",
        "connection_overdue_reminder",
        "system",
      ],
      request_direction: ["team_to_company", "company_to_team"],
      review_status: ["pending_review", "approved", "rejected", "expired"],
      solve_status: ["open", "in_progress", "solved"],
      tag_kind: ["field", "skill"],
      team_role: ["leader", "member"],
      template_kind: ["accept", "reject"],
      user_role: ["student", "company", "lecturer", "admin"],
    },
  },
} as const
