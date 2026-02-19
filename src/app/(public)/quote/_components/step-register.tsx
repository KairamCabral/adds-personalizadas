"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { quoteRegisterSchema, type QuoteRegisterFormData } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

interface StepRegisterProps {
  initialData?: Partial<QuoteRegisterFormData>;
  onNext: (data: QuoteRegisterFormData) => void;
  onBack: () => void;
}

export function StepRegister({ initialData, onNext, onBack }: StepRegisterProps) {
  const form = useForm<QuoteRegisterFormData>({
    resolver: zodResolver(quoteRegisterSchema),
    defaultValues: {
      nome: initialData?.nome ?? "",
      email: initialData?.email ?? "",
      telefone: initialData?.telefone ?? "",
      whatsapp: initialData?.whatsapp ?? "",
      cpf_cnpj: initialData?.cpf_cnpj ?? "",
      cidade: initialData?.cidade ?? "",
      estado: initialData?.estado ?? "",
      cep: initialData?.cep ?? "",
      rua: initialData?.rua ?? "",
      numero: initialData?.numero ?? "",
      bairro: initialData?.bairro ?? "",
    },
  });

  const handleSubmit = (data: QuoteRegisterFormData) => {
    onNext(data);
  };

  const fetchCep = async () => {
    const cep = form.getValues("cep")?.replace(/\D/g, "");
    if (cep?.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        form.setValue("rua", data.logradouro ?? "");
        form.setValue("bairro", data.bairro ?? "");
        form.setValue("cidade", data.localidade ?? "");
        form.setValue("estado", data.uf ?? "");
      }
    } catch {
      // ignore
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome completo</Label>
          <Input id="nome" placeholder="Seu nome" {...form.register("nome")} />
          {form.formState.errors.nome && (
            <p className="text-xs text-destructive">
              {form.formState.errors.nome.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            placeholder="(11) 99999-9999"
            {...form.register("telefone")}
          />
          {form.formState.errors.telefone && (
            <p className="text-xs text-destructive">
              {form.formState.errors.telefone.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            placeholder="(11) 99999-9999"
            {...form.register("whatsapp")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cpf_cnpj">CPF ou CNPJ</Label>
        <Input
          id="cpf_cnpj"
          placeholder="000.000.000-00 ou 00.000.000/0001-00"
          {...form.register("cpf_cnpj")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cep">CEP</Label>
          <Input
            id="cep"
            placeholder="00000-000"
            {...form.register("cep")}
            onBlur={fetchCep}
          />
          {form.formState.errors.cep && (
            <p className="text-xs text-destructive">
              {form.formState.errors.cep.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="estado">Estado</Label>
          <Select
            value={form.watch("estado")}
            onValueChange={(v) => form.setValue("estado", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.estado && (
            <p className="text-xs text-destructive">
              {form.formState.errors.estado.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cidade">Cidade</Label>
        <Input id="cidade" placeholder="Sua cidade" {...form.register("cidade")} />
        {form.formState.errors.cidade && (
          <p className="text-xs text-destructive">
            {form.formState.errors.cidade.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="rua">Rua</Label>
        <Input id="rua" placeholder="Nome da rua" {...form.register("rua")} />
        {form.formState.errors.rua && (
          <p className="text-xs text-destructive">
            {form.formState.errors.rua.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="numero">Número</Label>
          <Input id="numero" placeholder="123" {...form.register("numero")} />
          {form.formState.errors.numero && (
            <p className="text-xs text-destructive">
              {form.formState.errors.numero.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="bairro">Bairro</Label>
          <Input id="bairro" placeholder="Seu bairro" {...form.register("bairro")} />
          {form.formState.errors.bairro && (
            <p className="text-xs text-destructive">
              {form.formState.errors.bairro.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit">Próximo</Button>
      </div>
    </form>
  );
}
