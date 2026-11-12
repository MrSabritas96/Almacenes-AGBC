export function dateInputValue(text:string) {
  const trimmed=text.trim();
  const match=/^(\d{2})(\d{2})(\d{4})$/.exec(trimmed)??/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  const iso=match?`${match[3]}-${match[2]!.padStart(2,'0')}-${match[1]!.padStart(2,'0')}`:trimmed;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return '';
  const date=new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===iso?iso:'';
}
export const displayDate=(iso:string)=>iso?iso.split('-').reverse().join('/'):'';
