'use client';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronUp, LogOut } from 'lucide-react';
import { PostalLoader } from './postal-loader';

export function SidebarAccount({name,role,leaving,onLogout}:{name:string;role:string;leaving:boolean;onLogout:()=>Promise<void>}) {
  const initials=name.trim().split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase();
  return <div className="sidebar-account"><DropdownMenu.Root modal={false}>
    <DropdownMenu.Trigger asChild><button type="button" className="viewer-card sidebar-profile-trigger" aria-label={`Abrir menú de perfil de ${name}`} title={`${name} · ${role}`} disabled={leaving}>
      <span className="avatar" aria-hidden="true">{initials}</span><span className="profile-copy"><strong>{name}</strong><small>{role}</small></span><ChevronUp className="profile-chevron" size={16} aria-hidden="true"/>
    </button></DropdownMenu.Trigger>
    <DropdownMenu.Content className="account-menu" side="top" align="start" sideOffset={10} collisionPadding={12}>
      <DropdownMenu.Label className="account-menu-identity"><strong>{name}</strong><span>{role}</span></DropdownMenu.Label>
      <DropdownMenu.Separator className="account-menu-separator"/>
      <DropdownMenu.Item className="account-menu-logout" disabled={leaving} onSelect={event=>{event.preventDefault();void onLogout();}}>
        {leaving?<PostalLoader/>:<LogOut size={17} aria-hidden="true"/>}<span role={leaving?'status':undefined}>{leaving?'Cerrando sesión…':'Cerrar sesión'}</span>
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root></div>;
}
