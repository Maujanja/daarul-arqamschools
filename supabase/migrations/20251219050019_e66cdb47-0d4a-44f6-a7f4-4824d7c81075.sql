-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'parent');

-- Create user_roles table (following security best practices)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create students table
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    roll_number TEXT NOT NULL,
    class TEXT NOT NULL,
    parent_id UUID,
    admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Create teachers table
CREATE TABLE public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    subjects TEXT[] NOT NULL DEFAULT '{}',
    classes TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Create subjects table
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    max_marks INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Create marks table (simplified - only exam marks)
CREATE TABLE public.marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.teachers(id),
    class TEXT NOT NULL,
    exam INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    grade TEXT NOT NULL DEFAULT '-',
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(student_id, subject_id, term, academic_year)
);

ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;

-- Create parents table
CREATE TABLE public.parents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

-- Update students to reference parents
ALTER TABLE public.students ADD CONSTRAINT fk_parent FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE SET NULL;

-- Create feedback table
CREATE TABLE public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles" ON public.user_roles
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for students
CREATE POLICY "Admins and teachers can view all students" ON public.students
    FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Parents can view their own children" ON public.students
    FOR SELECT TO authenticated
    USING (parent_id IN (SELECT id FROM public.parents WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage students" ON public.students
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for teachers
CREATE POLICY "Admins can manage teachers" ON public.teachers
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can view all teachers" ON public.teachers
    FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can view their own record" ON public.teachers
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- RLS Policies for subjects
CREATE POLICY "Authenticated users can view subjects" ON public.subjects
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Admins can manage subjects" ON public.subjects
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for marks
CREATE POLICY "Admins can manage all marks" ON public.marks
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can manage marks for their classes" ON public.marks
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Parents can view their children marks" ON public.marks
    FOR SELECT TO authenticated
    USING (student_id IN (
        SELECT s.id FROM public.students s
        JOIN public.parents p ON s.parent_id = p.id
        WHERE p.user_id = auth.uid()
    ));

-- RLS Policies for parents
CREATE POLICY "Parents can view their own record" ON public.parents
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admins can manage parents" ON public.parents
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for feedback
CREATE POLICY "Parents can manage their own feedback" ON public.feedback
    FOR ALL TO authenticated
    USING (parent_id IN (SELECT id FROM public.parents WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all feedback" ON public.feedback
    FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can view feedback" ON public.feedback
    FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'teacher'));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON public.teachers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marks_updated_at BEFORE UPDATE ON public.marks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON public.feedback
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email), NEW.email);
    RETURN NEW;
END;
$$;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert initial subjects
INSERT INTO public.subjects (name, code, max_marks) VALUES
    ('Mathematics', 'MATH', 100),
    ('Science', 'SCI', 100),
    ('English', 'ENG', 100),
    ('History', 'HIST', 100),
    ('Geography', 'GEO', 100),
    ('Kiswahili', 'KIS', 100);