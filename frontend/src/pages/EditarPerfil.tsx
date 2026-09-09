import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Loader2, User as UserIcon, Mail, Phone, MapPin, Cake } from "lucide-react";
import { useAuth, PROVINCES } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { perfilApi, mensagemDeErroApi } from "@/lib/apiClient";

const EditarPerfil = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user, updateUserProfile } = useAuth();
  const { profile, loading: profileLoading, setProfile } = useProfile();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Garante que a hidratação do formulário a partir de `profile` só acontece
  // uma vez. Sem isto, qualquer `setProfile` feito por esta própria página
  // (ex.: ao trocar o avatar) reescreve TODOS os campos do formulário com os
  // últimos valores guardados -- apagando silenciosamente texto que o
  // utilizador tenha escrito e ainda não tenha submetido.
  const hidratadoRef = useRef(false);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/auth");
    }
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (profile && !hidratadoRef.current) {
      hidratadoRef.current = true;
      setName(profile.nome_completo ?? "");
      setBio(profile.biografia ?? "");
      setBirthdate(profile.data_nascimento ?? "");
      setGender(profile.genero ?? "");
      setPhone(profile.telefone ?? "");
      setProvince(profile.provincia ?? "");
      setAvatarUrl(profile.avatar_url ?? user?.avatarUrl);
    }
  }, [profile, user?.avatarUrl]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = ""; // permite escolher o mesmo ficheiro outra vez
    // O upload de avatar dependia do Supabase Storage — infraestrutura que
    // este projecto deixou de usar (ver CLAUDE.md secção 0). O substituto
    // (Cloudflare R2) ainda não tem endpoint na API. Mensagem honesta em
    // vez de tentar um upload que ia falhar contra dados que já não existem.
    toast.info("O envio de foto de perfil ainda não está disponível nesta infraestrutura nova.");
  };

  const initials = (name || "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    try {
      const data = await perfilApi.atualizar({
        nome_completo: name.trim() || profile.nome_completo,
        biografia: bio || null,
        data_nascimento: birthdate || null,
        genero: gender || null,
        telefone: phone || null,
        provincia: province || null,
      });

      setProfile({ ...profile, ...data, nome_completo: data.nome_completo ?? "" });
      // Ponte para a UI legada que ainda lê o AuthContext directamente
      // (ex.: consumidores fora do que este pedido cobriu explicitamente).
      updateUserProfile({
        name: data.nome_completo ?? "",
        province: data.provincia ?? "",
        biografia: data.biografia ?? "",
        telefone: data.telefone ?? "",
        dataNascimento: data.data_nascimento ?? "",
        gender: data.genero ?? "",
      });
      toast.success("O seu perfil foi atualizado com sucesso!");
    } catch (err) {
      console.error("Falha ao guardar o perfil:", err);
      toast.error(mensagemDeErroApi(err, "Não foi possível guardar as alterações. Tente novamente."));
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  if (profileLoading || !profile) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 pt-24 pb-16 px-4 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <BackButton />

          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">Editar Perfil</h1>
            <p className="text-muted-foreground">
              Atualize as suas informações pessoais, biografia e contactos.
            </p>
          </div>

          <Card className="shadow-lg border-border/60">
            <form onSubmit={handleSubmit}>
              {/* Section 1: Foto e Biografia */}
              <CardHeader>
                <CardTitle className="text-primary">Foto e Biografia</CardTitle>
                <CardDescription>Personalize a sua identidade visual e apresentação.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <Avatar className="w-24 h-24 border-4 border-primary/20">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                      {uploadingAvatar ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        initials
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center sm:text-left">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={handleAvatarChange}
                      disabled={uploadingAvatar}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                    >
                      {uploadingAvatar ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> A enviar...
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" /> Alterar Foto
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      JPG ou PNG. Máximo 2MB.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Biografia</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Conte um pouco sobre si, a sua jornada ou como o projeto o tem ajudado..."
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </CardContent>

              {/* Section 2: Dados Pessoais */}
              <CardHeader className="border-t border-border/60">
                <CardTitle className="text-primary">Dados Pessoais</CardTitle>
                <CardDescription>As suas informações básicas de identificação.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-muted-foreground" /> Nome Completo
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="O seu nome completo"
                    required
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="birthdate" className="flex items-center gap-2">
                      <Cake className="w-4 h-4 text-muted-foreground" /> Data de Nascimento
                    </Label>
                    <Input
                      id="birthdate"
                      type="date"
                      value={birthdate}
                      onChange={(e) => setBirthdate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Género</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="nao_dizer">Prefiro não dizer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>

              {/* Section 3: Contacto */}
              <CardHeader className="border-t border-border/60">
                <CardTitle className="text-primary">Informações de Contacto</CardTitle>
                <CardDescription>Como podemos comunicar consigo.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" /> Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={user.email}
                    disabled
                    className="bg-muted/40 cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">
                    O email é o seu identificador principal e não pode ser alterado.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" /> Telefone
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+244 923 000 000"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" /> Província
                  </Label>
                  <Select value={province} onValueChange={setProvince}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a sua província" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {PROVINCES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>

              <CardContent className="border-t border-border/60 pt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="min-w-[180px]">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> A guardar...
                    </>
                  ) : (
                    "Salvar Alterações"
                  )}
                </Button>
              </CardContent>
            </form>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default EditarPerfil;
