--
-- PostgreSQL database dump
--

-- Dumped from database version 14.18
-- Dumped by pg_dump version 14.18

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type for PostgreSQL (vector similarity search)';


--
-- Name: document_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.document_type AS ENUM (
    'lege',
    'hotarare',
    'ordonanta',
    'ordonanta_de_urgenta',
    'decizie',
    'ordin',
    'regulament',
    'norme',
    'norme_metodologice',
    'metodologie',
    'program',
    'strategie_nationala',
    'ghid_finantare',
    'ghid',
    'cod',
    'criterii_si_norme',
    'caiet_de_sarcini',
    'anexa',
    'decret',
    'acord',
    'protocol',
    'tratat',
    'conventie',
    'UNKNOWN',
    'statut',
    'circulara',
    'memorandum',
    'lista',
    'prescriptie',
    'procedura',
    'reglementari'
);


ALTER TYPE public.document_type OWNER TO postgres;

--
-- Name: node_level_new; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.node_level_new AS ENUM (
    'carte',
    'titlu',
    'capitol',
    'parte',
    'articol',
    'paragraf',
    'litera',
    'alineat',
    'nota',
    'anexa',
    'semnatura',
    'metadata'
);


ALTER TYPE public.node_level_new OWNER TO postgres;

--
-- Name: reference_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.reference_type_enum AS ENUM (
    'modifies',
    'is_modified_by',
    'completes',
    'is_completed_by',
    'abrogates',
    'is_abrogated_by',
    'refers_to',
    'is_referred_by',
    'updates',
    'suspends',
    'is_suspended_by',
    'corrects',
    'is_corrected_by'
);


ALTER TYPE public.reference_type_enum OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chats; Type: TABLE; Schema: public; Owner: andicretu
--

CREATE TABLE public.chats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    links jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.chats OWNER TO andicretu;

--
-- Name: document_references; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_references (
    id integer NOT NULL,
    source_document_id integer NOT NULL,
    target_document_id integer NOT NULL,
    rreference_type public.reference_type_enum NOT NULL,
    section_label text,
    details text
);


ALTER TABLE public.document_references OWNER TO postgres;

--
-- Name: document_references_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_references_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.document_references_id_seq OWNER TO postgres;

--
-- Name: document_references_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_references_id_seq OWNED BY public.document_references.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    source_id character varying(255) NOT NULL,
    code character varying(255) NOT NULL,
    title text NOT NULL,
    type public.document_type NOT NULL,
    url text,
    emitent text,
    publication_date date,
    fetched_at timestamp without time zone DEFAULT now(),
    notes text,
    domain text,
    keywords text[],
    text text,
    parsed boolean DEFAULT false,
    chunked boolean
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.documents_id_seq OWNER TO postgres;

--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: law_chunks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.law_chunks (
    chunk_id integer NOT NULL,
    document_id integer NOT NULL,
    start_node_id integer NOT NULL,
    end_node_id integer NOT NULL,
    chunk_text text NOT NULL,
    sequence_idx integer NOT NULL,
    token_count integer NOT NULL,
    embedding public.vector(1536)
);


ALTER TABLE public.law_chunks OWNER TO postgres;

--
-- Name: law_chunks_chunk_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.law_chunks_chunk_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.law_chunks_chunk_id_seq OWNER TO postgres;

--
-- Name: law_chunks_chunk_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.law_chunks_chunk_id_seq OWNED BY public.law_chunks.chunk_id;


--
-- Name: legal_references; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.legal_references (
    id integer NOT NULL,
    source_detalii_id integer NOT NULL,
    reference_type public.reference_type_enum NOT NULL,
    target_code_text character varying(255) NOT NULL,
    section_label character varying(255),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.legal_references OWNER TO postgres;

--
-- Name: legal_references_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.legal_references_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.legal_references_id_seq OWNER TO postgres;

--
-- Name: legal_references_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.legal_references_id_seq OWNED BY public.legal_references.id;


--
-- Name: nodes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nodes (
    id integer NOT NULL,
    document_id integer NOT NULL,
    parent_id integer,
    level public.node_level_new NOT NULL,
    label text,
    content text NOT NULL,
    sort_order integer,
    section_type text,
    source_class character varying(50)
);


ALTER TABLE public.nodes OWNER TO postgres;

--
-- Name: nodes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nodes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nodes_id_seq OWNER TO postgres;

--
-- Name: nodes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nodes_id_seq OWNED BY public.nodes.id;


--
-- Name: printable_ids; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.printable_ids (
    id integer NOT NULL,
    detalii_id integer NOT NULL,
    printable_code text NOT NULL,
    url text GENERATED ALWAYS AS (('https://legislatie.just.ro/Public/FormaPrintabila/'::text || printable_code)) STORED,
    collected_at timestamp without time zone DEFAULT now(),
    domain text[]
);


ALTER TABLE public.printable_ids OWNER TO postgres;

--
-- Name: printable_ids_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.printable_ids_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.printable_ids_id_seq OWNER TO postgres;

--
-- Name: printable_ids_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.printable_ids_id_seq OWNED BY public.printable_ids.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: andicretu
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth0_id text NOT NULL,
    email text,
    username text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO andicretu;

--
-- Name: document_references id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_references ALTER COLUMN id SET DEFAULT nextval('public.document_references_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: law_chunks chunk_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.law_chunks ALTER COLUMN chunk_id SET DEFAULT nextval('public.law_chunks_chunk_id_seq'::regclass);


--
-- Name: legal_references id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.legal_references ALTER COLUMN id SET DEFAULT nextval('public.legal_references_id_seq'::regclass);


--
-- Name: nodes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nodes ALTER COLUMN id SET DEFAULT nextval('public.nodes_id_seq'::regclass);


--
-- Name: printable_ids id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.printable_ids ALTER COLUMN id SET DEFAULT nextval('public.printable_ids_id_seq'::regclass);


--
-- Name: chats chats_pkey; Type: CONSTRAINT; Schema: public; Owner: andicretu
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_pkey PRIMARY KEY (id);


--
-- Name: document_references document_references_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_references
    ADD CONSTRAINT document_references_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: documents documents_source_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_source_id_key UNIQUE (source_id);


--
-- Name: law_chunks law_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.law_chunks
    ADD CONSTRAINT law_chunks_pkey PRIMARY KEY (chunk_id);


--
-- Name: legal_references legal_references_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.legal_references
    ADD CONSTRAINT legal_references_pkey PRIMARY KEY (id);


--
-- Name: printable_ids printable_ids_detalii_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.printable_ids
    ADD CONSTRAINT printable_ids_detalii_id_key UNIQUE (detalii_id);


--
-- Name: printable_ids printable_ids_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.printable_ids
    ADD CONSTRAINT printable_ids_pkey PRIMARY KEY (id);


--
-- Name: printable_ids printable_ids_printable_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.printable_ids
    ADD CONSTRAINT printable_ids_printable_code_key UNIQUE (printable_code);


--
-- Name: users users_auth0_id_key; Type: CONSTRAINT; Schema: public; Owner: andicretu
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_auth0_id_key UNIQUE (auth0_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: andicretu
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: andicretu
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: andicretu
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: chats_user_id_idx; Type: INDEX; Schema: public; Owner: andicretu
--

CREATE INDEX chats_user_id_idx ON public.chats USING btree (user_id);


--
-- Name: idx_legal_references_reference_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_legal_references_reference_type ON public.legal_references USING btree (reference_type);


--
-- Name: idx_legal_references_source_detalii_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_legal_references_source_detalii_id ON public.legal_references USING btree (source_detalii_id);


--
-- Name: idx_nodes_document_sort_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nodes_document_sort_order ON public.nodes USING btree (document_id, sort_order);


--
-- Name: law_chunks_document_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX law_chunks_document_id_idx ON public.law_chunks USING btree (document_id);


--
-- Name: law_chunks_embedding_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX law_chunks_embedding_idx ON public.law_chunks USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: law_chunks_sequence_idx_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX law_chunks_sequence_idx_idx ON public.law_chunks USING btree (sequence_idx);


--
-- Name: document_references document_references_source_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_references
    ADD CONSTRAINT document_references_source_document_id_fkey FOREIGN KEY (source_document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: document_references document_references_target_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_references
    ADD CONSTRAINT document_references_target_document_id_fkey FOREIGN KEY (target_document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: law_chunks law_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.law_chunks
    ADD CONSTRAINT law_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: nodes nodes_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nodes
    ADD CONSTRAINT nodes_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA public TO andicretu;


--
-- Name: TABLE document_references; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.document_references TO andicretu;


--
-- Name: SEQUENCE document_references_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.document_references_id_seq TO andicretu;


--
-- Name: TABLE documents; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.documents TO andicretu;


--
-- Name: SEQUENCE documents_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.documents_id_seq TO andicretu;


--
-- Name: TABLE law_chunks; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.law_chunks TO andicretu;


--
-- Name: SEQUENCE law_chunks_chunk_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.law_chunks_chunk_id_seq TO andicretu;


--
-- Name: TABLE legal_references; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.legal_references TO andicretu;


--
-- Name: SEQUENCE legal_references_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.legal_references_id_seq TO andicretu;


--
-- Name: TABLE nodes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.nodes TO andicretu;


--
-- Name: SEQUENCE nodes_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.nodes_id_seq TO andicretu;


--
-- Name: TABLE printable_ids; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.printable_ids TO andicretu;


--
-- Name: SEQUENCE printable_ids_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE public.printable_ids_id_seq TO andicretu;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES  TO andicretu;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES  TO andicretu;


--
-- PostgreSQL database dump complete
--

