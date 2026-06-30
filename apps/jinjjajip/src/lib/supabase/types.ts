/**
 * Supabase Database 타입 — 캐논 스키마(002_schema.sql) 기반 최소 정의.
 * 컬럼명은 DB 스네이크케이스 그대로 유지. 앱 레이어 변환은 data/ 레이어에서 수행.
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: "tenant" | "agent" | "admin";
          phone_verified: boolean;
          identity_verified: boolean;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };

      listings: {
        Row: {
          id: string;
          title: string;
          address: string;
          region: "gwanak" | "mapo";
          building_type: "oneroom" | "officetel";
          deposit_manwon: number;
          monthly_rent_manwon: number;
          geo: unknown | null;
          status: "verified" | "pending" | "processing" | "reported" | "taken_down";
          agent_id: string | null;
          natural_label: string | null;
          trust_score: number;
          trust_grade: "gold" | "silver" | "unverified";
          sort_rank: number;
          thumbnail_url: string | null;
          description: string | null;
          area_m2: number | null;
          floor: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["listings"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["listings"]["Insert"]>;
      };

      score_items: {
        Row: {
          id: string;
          listing_id: string;
          key: "photo" | "exif" | "community" | "owner" | "transaction";
          /** null = pending. 0은 검증했으나 0점. 절대 구분. */
          earned: number | null;
          max: number;
          status: "verified" | "pending" | "processing" | "reported";
          verified_at: string | null;
          delta_if_reported: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["score_items"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["score_items"]["Insert"]>;
      };

      photos: {
        Row: {
          id: string;
          listing_id: string;
          uploader_id: string;
          /** 비공개 버킷 경로 — 절대 공개 URL 생성 금지 */
          original_path: string;
          /** 공개 버킷 경로 — AI 블러 통과 + 승인 후에만 채워짐 */
          blurred_path: string | null;
          status: "processing" | "approved" | "rejected";
          exif: Record<string, unknown> | null;
          liveness_score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["photos"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["photos"]["Insert"]>;
      };

      reports: {
        Row: {
          id: string;
          listing_id: string;
          reporter_id: string;
          reason:
            | "fake_listing"
            | "wrong_photo"
            | "wrong_price"
            | "already_taken"
            | "duplicate"
            | "other";
          detail: string | null;
          evidence_photo_id: string | null;
          status: "received" | "reviewing" | "resolved" | "dismissed";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["reports"]["Row"],
          "id" | "created_at" | "updated_at" | "status"
        >;
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
      };

      uploads: {
        Row: {
          id: string;
          listing_id: string;
          uploader_id: string;
          accepted_count: number;
          rejected_count: number;
          status: "processing" | "error" | "done";
          /** null = 파이프라인 미완료. 낙관적 채움 금지 */
          score_delta: number | null;
          badge_achieved: "gold" | "silver" | "unverified" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["uploads"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<Database["public"]["Tables"]["uploads"]["Insert"]>;
      };
    };

    Functions: {
      recompute_listing_score: {
        Args: { listing_id: string };
        Returns: void;
      };
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
