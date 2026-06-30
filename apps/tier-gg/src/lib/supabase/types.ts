/**
 * Supabase DB 타입 정의 — SQL 마이그레이션(0001_init.sql)과 1:1 일치
 * DB설계자 스키마 단일 진실 원본 기준
 * 실제 DB 연결 후 `supabase gen types typescript` 로 대체 권장
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** BIGSERIAL → Supabase JS 클라이언트는 bigint를 string으로 반환 (정밀도 보존) */
type DbId = string;

export type EntityStatus = "draft" | "review" | "published";
export type SourceType = "official" | "aggregator" | "community";
export type ConfidenceLevel = "T1" | "T2" | "T3";

export interface Database {
  public: {
    Tables: {
      categories: {
        Relationships: [];
        Row: {
          id: DbId;
          slug: string;
          name: string;
          schema: Json;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: DbId;
          slug: string;
          name: string;
          schema?: Json;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: DbId;
          slug?: string;
          name?: string;
          schema?: Json;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
      };
      providers: {
        Relationships: [];
        Row: {
          id: DbId;
          slug: string;
          name: string;
          country: string | null;
          website: string | null;
          logo_color: string | null;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: DbId;
          slug: string;
          name: string;
          country?: string | null;
          website?: string | null;
          logo_color?: string | null;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: DbId;
          slug?: string;
          name?: string;
          country?: string | null;
          website?: string | null;
          logo_color?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
      };
      entities: {
        Relationships: [
          {
            foreignKeyName: "entities_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entities_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "providers";
            referencedColumns: ["id"];
          },
        ];
        Row: {
          id: DbId;
          category_id: DbId;
          slug: string;
          name: string;
          provider_id: DbId | null;
          status: EntityStatus;
          released_at: string | null;
          summary: string | null;
          attrs: Json;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: DbId;
          category_id: DbId;
          slug: string;
          name: string;
          provider_id?: DbId | null;
          status?: EntityStatus;
          released_at?: string | null;
          summary?: string | null;
          attrs?: Json;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: DbId;
          category_id?: DbId;
          slug?: string;
          name?: string;
          provider_id?: DbId | null;
          status?: EntityStatus;
          released_at?: string | null;
          summary?: string | null;
          attrs?: Json;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
      };
      benchmarks: {
        Relationships: [
          {
            foreignKeyName: "benchmarks_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
        Row: {
          id: DbId;
          category_id: DbId;
          slug: string;
          name: string;
          scale: number | null;
          unit: string | null;
          description: string | null;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: DbId;
          category_id: DbId;
          slug: string;
          name: string;
          scale?: number | null;
          unit?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: DbId;
          category_id?: DbId;
          slug?: string;
          name?: string;
          scale?: number | null;
          unit?: string | null;
          description?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
      };
      sources: {
        Relationships: [];
        Row: {
          id: DbId;
          url: string;
          type: SourceType;
          confidence: ConfidenceLevel;
          fetched_at: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: DbId;
          url: string;
          type: SourceType;
          confidence: ConfidenceLevel;
          fetched_at?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: DbId;
          url?: string;
          type?: SourceType;
          confidence?: ConfidenceLevel;
          fetched_at?: string | null;
          verified_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
      };
      scores: {
        Relationships: [
          {
            foreignKeyName: "scores_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scores_benchmark_id_fkey";
            columns: ["benchmark_id"];
            isOneToOne: false;
            referencedRelation: "benchmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scores_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
        Row: {
          id: DbId;
          entity_id: DbId;
          benchmark_id: DbId;
          value: number;
          source_id: DbId | null;
          measured_at: string | null;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: DbId;
          entity_id: DbId;
          benchmark_id: DbId;
          value: number;
          source_id?: DbId | null;
          measured_at?: string | null;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: DbId;
          entity_id?: DbId;
          benchmark_id?: DbId;
          value?: number;
          source_id?: DbId | null;
          measured_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
      };
      changelog: {
        Relationships: [
          {
            foreignKeyName: "changelog_entity_id_fkey";
            columns: ["entity_id"];
            isOneToOne: false;
            referencedRelation: "entities";
            referencedColumns: ["id"];
          },
        ];
        Row: {
          id: DbId;
          entity_id: DbId | null;
          field: string;
          old_value: Json | null;
          new_value: Json | null;
          changed_at: string;
          changed_by: string | null;
          created_at: string;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: DbId;
          entity_id?: DbId | null;
          field: string;
          old_value?: Json | null;
          new_value?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          created_at?: string;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: DbId;
          entity_id?: DbId | null;
          field?: string;
          old_value?: Json | null;
          new_value?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      entity_status: EntityStatus;
      source_type: SourceType;
      confidence_level: ConfidenceLevel;
    };
  };
}
