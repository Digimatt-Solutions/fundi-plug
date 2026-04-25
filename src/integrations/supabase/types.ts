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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          detail: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          detail?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          detail?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability: {
        Row: {
          day_of_week: number
          end_time: string
          id: string
          start_time: string
          worker_id: string
        }
        Insert: {
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
          worker_id: string
        }
        Update: {
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
          worker_id?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          job_id: string
          notes: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          job_id: string
          notes?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          job_id?: string
          notes?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          cert_number: string | null
          created_at: string
          expires_at: string | null
          file_url: string | null
          id: string
          issued_at: string | null
          issuer: string | null
          name: string
          worker_id: string
        }
        Insert: {
          cert_number?: string | null
          created_at?: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          issued_at?: string | null
          issuer?: string | null
          name: string
          worker_id: string
        }
        Update: {
          cert_number?: string | null
          created_at?: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          issued_at?: string | null
          issuer?: string | null
          name?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certifications_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "worker_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_blogs: {
        Row: {
          author_id: string
          blog_type: string
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          blog_type?: string
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          blog_type?: string
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_blogs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          likes_count: number
          post_type: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          post_type?: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number
          post_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          admin_reply: string | null
          created_at: string
          customer_id: string
          fundi_id: string
          id: string
          job_id: string
          message: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          customer_id: string
          fundi_id: string
          id?: string
          job_id: string
          message: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          customer_id?: string
          fundi_id?: string
          id?: string
          job_id?: string
          message?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_fundi_id_fkey"
            columns: ["fundi_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          cover_note: string | null
          created_at: string
          id: string
          job_id: string
          proposed_rate: number | null
          status: string
          worker_id: string
        }
        Insert: {
          cover_note?: string | null
          created_at?: string
          id?: string
          job_id: string
          proposed_rate?: number | null
          status?: string
          worker_id: string
        }
        Update: {
          cover_note?: string | null
          created_at?: string
          id?: string
          job_id?: string
          proposed_rate?: number | null
          status?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          address: string | null
          budget: number | null
          category_id: string | null
          created_at: string
          customer_id: string
          description: string | null
          id: string
          image_url: string | null
          is_instant: boolean
          latitude: number | null
          longitude: number | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          address?: string | null
          budget?: number | null
          category_id?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_instant?: boolean
          latitude?: number | null
          longitude?: number | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          address?: string | null
          budget?: number | null
          category_id?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_instant?: boolean
          latitude?: number | null
          longitude?: number | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      module_settings: {
        Row: {
          enabled: boolean
          id: string
          label: string
          module_key: string
          role: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: string
          label: string
          module_key: string
          role: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: string
          label?: string
          module_key?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          commission: number | null
          created_at: string
          id: string
          job_id: string
          payee_id: string
          payer_id: string
          status: Database["public"]["Enums"]["payment_status"]
          stripe_payment_id: string | null
        }
        Insert: {
          amount: number
          commission?: number | null
          created_at?: string
          id?: string
          job_id: string
          payee_id: string
          payer_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_id?: string | null
        }
        Update: {
          amount?: number
          commission?: number | null
          created_at?: string
          id?: string
          job_id?: string
          payee_id?: string
          payer_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payee_id_fkey"
            columns: ["payee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_otps: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          id: string
          otp_hash: string
          phone_number: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at: string
          id?: string
          otp_hash: string
          phone_number: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          phone_number?: string
          verified?: boolean
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          is_online: boolean
          latitude: number | null
          longitude: number | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          is_online?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          is_online?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          job_id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          job_id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          job_id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
        }
        Relationships: []
      }
      site_visits: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device: string | null
          id: string
          os: string | null
          path: string
          referrer: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          os?: string | null
          path: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          os?: string | null
          path?: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webauthn_credentials: {
        Row: {
          created_at: string
          credential_id: string
          device_label: string | null
          email: string | null
          id: string
          last_used_at: string | null
          public_key: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_id: string
          device_label?: string | null
          email?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          credential_id?: string
          device_label?: string | null
          email?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webauthn_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          id: string
          processed_at: string | null
          processed_by: string | null
          requested_at: string
          status: Database["public"]["Enums"]["withdrawal_status"]
          worker_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          worker_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          worker_id?: string
        }
        Relationships: []
      }
      worker_education: {
        Row: {
          course: string | null
          created_at: string
          end_date: string | null
          file_url: string | null
          id: string
          institution: string
          level: string
          start_date: string | null
          status: string | null
          worker_id: string
        }
        Insert: {
          course?: string | null
          created_at?: string
          end_date?: string | null
          file_url?: string | null
          id?: string
          institution: string
          level: string
          start_date?: string | null
          status?: string | null
          worker_id: string
        }
        Update: {
          course?: string | null
          created_at?: string
          end_date?: string | null
          file_url?: string | null
          id?: string
          institution?: string
          level?: string
          start_date?: string | null
          status?: string | null
          worker_id?: string
        }
        Relationships: []
      }
      worker_profiles: {
        Row: {
          alt_phone: string | null
          availability_days: number[] | null
          availability_type: string | null
          bank_account: string | null
          bank_name: string | null
          bio: string | null
          consent_background_check: boolean | null
          consent_data_usage: boolean | null
          consented_at: string | null
          constituency: string | null
          country: string | null
          county: string | null
          created_at: string
          daily_rate: number | null
          date_of_birth: string | null
          exact_address: string | null
          experience_level: string | null
          first_name: string | null
          gender: string | null
          hourly_rate: number | null
          id: string
          id_back_url: string | null
          id_front_url: string | null
          id_number: string | null
          is_online: boolean
          kra_pin: string | null
          landmark: string | null
          last_name: string | null
          latitude: number | null
          longitude: number | null
          max_travel_km: number | null
          middle_name: string | null
          mpesa_name: string | null
          mpesa_number: string | null
          nca_number: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          next_of_kin_relationship: string | null
          onboarding_completed_at: string | null
          onboarding_step: number
          other_skill: string | null
          portfolio_urls: string[] | null
          profile_photo_url: string | null
          rejection_reason: string | null
          selfie_with_id_url: string | null
          service_area: string | null
          service_radius_km: number | null
          skills: string[] | null
          sub_skills: string[] | null
          submitted_for_review: boolean
          tools_owned: string[] | null
          updated_at: string
          user_id: string
          verification_status: Database["public"]["Enums"]["verification_status"]
          ward: string | null
          willing_to_travel: boolean | null
          years_experience: number | null
        }
        Insert: {
          alt_phone?: string | null
          availability_days?: number[] | null
          availability_type?: string | null
          bank_account?: string | null
          bank_name?: string | null
          bio?: string | null
          consent_background_check?: boolean | null
          consent_data_usage?: boolean | null
          consented_at?: string | null
          constituency?: string | null
          country?: string | null
          county?: string | null
          created_at?: string
          daily_rate?: number | null
          date_of_birth?: string | null
          exact_address?: string | null
          experience_level?: string | null
          first_name?: string | null
          gender?: string | null
          hourly_rate?: number | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          id_number?: string | null
          is_online?: boolean
          kra_pin?: string | null
          landmark?: string | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          max_travel_km?: number | null
          middle_name?: string | null
          mpesa_name?: string | null
          mpesa_number?: string | null
          nca_number?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          onboarding_completed_at?: string | null
          onboarding_step?: number
          other_skill?: string | null
          portfolio_urls?: string[] | null
          profile_photo_url?: string | null
          rejection_reason?: string | null
          selfie_with_id_url?: string | null
          service_area?: string | null
          service_radius_km?: number | null
          skills?: string[] | null
          sub_skills?: string[] | null
          submitted_for_review?: boolean
          tools_owned?: string[] | null
          updated_at?: string
          user_id: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          ward?: string | null
          willing_to_travel?: boolean | null
          years_experience?: number | null
        }
        Update: {
          alt_phone?: string | null
          availability_days?: number[] | null
          availability_type?: string | null
          bank_account?: string | null
          bank_name?: string | null
          bio?: string | null
          consent_background_check?: boolean | null
          consent_data_usage?: boolean | null
          consented_at?: string | null
          constituency?: string | null
          country?: string | null
          county?: string | null
          created_at?: string
          daily_rate?: number | null
          date_of_birth?: string | null
          exact_address?: string | null
          experience_level?: string | null
          first_name?: string | null
          gender?: string | null
          hourly_rate?: number | null
          id?: string
          id_back_url?: string | null
          id_front_url?: string | null
          id_number?: string | null
          is_online?: boolean
          kra_pin?: string | null
          landmark?: string | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          max_travel_km?: number | null
          middle_name?: string | null
          mpesa_name?: string | null
          mpesa_number?: string | null
          nca_number?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          onboarding_completed_at?: string | null
          onboarding_step?: number
          other_skill?: string | null
          portfolio_urls?: string[] | null
          profile_photo_url?: string | null
          rejection_reason?: string | null
          selfie_with_id_url?: string | null
          service_area?: string | null
          service_radius_km?: number | null
          skills?: string[] | null
          sub_skills?: string[] | null
          submitted_for_review?: boolean
          tools_owned?: string[] | null
          updated_at?: string
          user_id?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
          ward?: string | null
          willing_to_travel?: boolean | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_work_history: {
        Row: {
          company: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          reference_name: string | null
          reference_phone: string | null
          role: string
          start_date: string | null
          worker_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          reference_name?: string | null
          reference_phone?: string | null
          role: string
          start_date?: string | null
          worker_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          reference_name?: string | null
          reference_phone?: string | null
          role?: string
          start_date?: string | null
          worker_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
      app_role: "admin" | "moderator" | "customer" | "worker"
      booking_status:
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
      job_status:
        | "pending"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
      payment_status: "pending" | "completed" | "failed" | "refunded"
      verification_status: "pending" | "approved" | "rejected"
      withdrawal_status: "pending" | "approved" | "rejected" | "completed"
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
      app_role: ["admin", "moderator", "customer", "worker"],
      booking_status: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      job_status: [
        "pending",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
      ],
      payment_status: ["pending", "completed", "failed", "refunded"],
      verification_status: ["pending", "approved", "rejected"],
      withdrawal_status: ["pending", "approved", "rejected", "completed"],
    },
  },
} as const
