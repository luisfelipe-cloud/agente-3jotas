import Image from "next/image";
import Link from "next/link";
import { CadastroForm } from "@/components/CadastroForm";

export default function CadastroPage() {
  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex md:w-3/4 relative items-center justify-center bg-white overflow-hidden">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-coral-600/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-coral-600/10 blur-3xl" />
        <div className="absolute top-0 left-0 h-full w-1.5 bg-coral-600" />

        <div className="relative">
          <Image src="/tresjotas_logo-removebg-preview.png" alt="Três Jotas" width={280} height={102} priority />
        </div>
      </div>

      <div className="w-full md:w-1/4 flex items-center justify-center px-6 py-12 bg-navy-600">
        <div className="w-full max-w-xs space-y-8">
          <div className="md:hidden flex justify-center">
            <Image src="/tresjotas_logo-removebg-preview.png" alt="Três Jotas" width={140} height={51} priority />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Criar conta</h1>
            <p className="text-sm text-white/80 mt-1">
              Cadastre-se pra acessar suas análises. Depois de criar a conta, peça pro seu gestor liberar o acesso.
            </p>
          </div>
          <CadastroForm />
          <p className="text-sm text-white/80 text-center">
            Já tem conta?{" "}
            <Link href="/login" className="font-semibold text-white hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
