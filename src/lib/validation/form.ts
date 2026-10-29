// Đổi FormData thành object để Zod kiểm tra.
//  - Tên ô có dấu chấm tạo object lồng nhau: "extra.background" -> { extra: { background } }
//  - Ô chọn nhiều (checkbox/select multiple) khai báo trong arrayKeys -> mảng
//  - Thành viên của project/product/paper: mỗi người là một checkbox "member_ids" giá trị profile_id,
//    kèm ô "member_role.<profile_id>" (role_label) -> members: [{ profile_id, role_label }]
//  - Bỏ qua tệp (File) và các ô nội bộ của React ($ACTION_...)
export function formToObject(fd: FormData, arrayKeys: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== 'string' || key.startsWith('$ACTION') || arrayKeys.includes(key)) continue;
    if (key === 'member_ids' || key.startsWith('member_role.')) continue;
    setPath(out, key.split('.'), value);
  }
  for (const key of arrayKeys) {
    setPath(out, key.split('.'), fd.getAll(key).filter((v): v is string => typeof v === 'string' && v.trim() !== ''));
  }
  const memberIds = fd.getAll('member_ids').filter((v): v is string => typeof v === 'string' && v !== '');
  if (memberIds.length || fd.has('member_ids')) {
    out.members = memberIds.map((id) => ({ profile_id: id, role_label: fd.get(`member_role.${id}`) ?? undefined }));
  }
  return out;
}

function setPath(target: Record<string, unknown>, path: string[], value: unknown) {
  let node = target;
  path.forEach((part, i) => {
    if (part === '__proto__' || part === 'constructor' || part === 'prototype') return;
    if (i === path.length - 1) {
      node[part] = value;
    } else {
      if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
      node = node[part] as Record<string, unknown>;
    }
  });
}
