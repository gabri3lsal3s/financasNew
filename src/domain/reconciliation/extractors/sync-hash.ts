/**
 * Implementação pura e síncrona de SHA-1, SHA-256 e SHA-512 (zero dependências).
 * Usada no loop de derivação de chave (spinCount=100.000) do MS-OFFCRYPTO para evitar
 * overhead de 100k microtasks assíncronas no Web Crypto (~15 ms vs ~3-5 s).
 */

export type SyncHashAlgorithm = "SHA1" | "SHA256" | "SHA512";

function rotl32(val: number, shift: number): number {
  return (val << shift) | (val >>> (32 - shift));
}

function rotr32(val: number, shift: number): number {
  return (val >>> shift) | (val << (32 - shift));
}

const SHA1_W = new Int32Array(80);

export function sha1Sync(input: Uint8Array): Uint8Array {
  const len = input.length;
  const bitLen = len * 8;
  const paddedLen = Math.ceil((len + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(input);
  padded[len] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x67452301 | 0;
  let h1 = 0xefcdab89 | 0;
  let h2 = 0x98badcfe | 0;
  let h3 = 0x10325476 | 0;
  let h4 = 0xc3d2e1f0 | 0;

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      SHA1_W[i] = view.getInt32(offset + i * 4, false);
    }
    for (let i = 16; i < 80; i++) {
      SHA1_W[i] = rotl32(
        SHA1_W[i - 3]! ^ SHA1_W[i - 8]! ^ SHA1_W[i - 14]! ^ SHA1_W[i - 16]!,
        1,
      );
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999 | 0;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1 | 0;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc | 0;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6 | 0;
      }
      const temp = (rotl32(a, 5) + f + e + k + SHA1_W[i]!) | 0;
      e = d;
      d = c;
      c = rotl32(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  outView.setInt32(0, h0, false);
  outView.setInt32(4, h1, false);
  outView.setInt32(8, h2, false);
  outView.setInt32(12, h3, false);
  outView.setInt32(16, h4, false);
  return out;
}

const SHA256_K = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const SHA256_W = new Int32Array(64);

export function sha256Sync(input: Uint8Array): Uint8Array {
  const len = input.length;
  const bitLen = len * 8;
  const paddedLen = Math.ceil((len + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(input);
  padded[len] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667 | 0;
  let h1 = 0xbb67ae85 | 0;
  let h2 = 0x3c6ef372 | 0;
  let h3 = 0xa54ff53a | 0;
  let h4 = 0x510e527f | 0;
  let h5 = 0x9b05688c | 0;
  let h6 = 0x1f83d9ab | 0;
  let h7 = 0x5be0cd19 | 0;

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      SHA256_W[i] = view.getInt32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const w15 = SHA256_W[i - 15]!;
      const w2 = SHA256_W[i - 2]!;
      const s0 = rotr32(w15, 7) ^ rotr32(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr32(w2, 17) ^ rotr32(w2, 19) ^ (w2 >>> 10);
      SHA256_W[i] = (SHA256_W[i - 16]! + s0 + SHA256_W[i - 7]! + s1) | 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i]! + SHA256_W[i]!) | 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setInt32(0, h0, false);
  outView.setInt32(4, h1, false);
  outView.setInt32(8, h2, false);
  outView.setInt32(12, h3, false);
  outView.setInt32(16, h4, false);
  outView.setInt32(20, h5, false);
  outView.setInt32(24, h6, false);
  outView.setInt32(28, h7, false);
  return out;
}

const SHA512_K_HI = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  0xca273ece, 0xd186b8c7, 0xeada7dd6, 0xf57d4f7f, 0x06f067aa, 0x0a637dc5, 0x113f9804, 0x1b710b35,
  0x28db77f5, 0x32caab7b, 0x3c9ebe0a, 0x431d67c4, 0x4cc5d4be, 0x597f299c, 0x5fcb6fab, 0x6c44198c,
]);
const SHA512_K_LO = new Int32Array([
  0xd728ae22, 0x23ef65cd, 0xec4d3b2f, 0x8189dbbc, 0xf348b538, 0xb605d019, 0xaf194f9b, 0xda6d8118,
  0xa3030242, 0x45706fbe, 0x4ee4b28c, 0xd5ffb4e2, 0xf27b896f, 0x3b1696b1, 0x25c71235, 0xcf692694,
  0x9ef14ad2, 0x384f25e3, 0x8b8cd5b5, 0x77ac9c65, 0x592b0275, 0x6ea6e483, 0xbd41fbd4, 0x831153b5,
  0xee66dfab, 0x2db43210, 0x98fb213f, 0xbeef0ee4, 0x3da88fc2, 0x930aa725, 0xe003826f, 0x0a0e6e70,
  0x46d22ffc, 0x5c26c926, 0x5ac42aed, 0x9d95b3df, 0x8baf63de, 0x3c77b2a8, 0x47edaee6, 0x1482353b,
  0x4cf10364, 0xbc423001, 0xd0f89791, 0x0654be30, 0xd6ef5218, 0x5565a910, 0x5771202a, 0x32bbd1b8,
  0xb8d2d0c8, 0x5141ab53, 0xdf8eeb99, 0xe19b48a8, 0xc5c95a63, 0xe3418acb, 0x7763e373, 0xd6b2b8a3,
  0x5defb2fc, 0x43172f60, 0xa1f0ab72, 0x1a6439ec, 0x23631e28, 0xde82bde9, 0xb2c67915, 0xe372532b,
  0xea26619c, 0x21c0c207, 0xcde0eb1e, 0xee6ed178, 0x72176fba, 0xa2c898a6, 0xbef90dae, 0x131c471b,
  0x23047d84, 0x40c72493, 0x15c9bebc, 0x9c100d4c, 0xcb3e42b6, 0xfc657e2a, 0x3ad6faec, 0x4a475817,
]);

const SHA512_W_HI = new Int32Array(80);
const SHA512_W_LO = new Int32Array(80);

function add64Lo(aLo: number, bLo: number): number {
  return (aLo + bLo) | 0;
}

function add64Carry(aLo: number, bLo: number): number {
  return (aLo >>> 0) + (bLo >>> 0) >= 0x100000000 ? 1 : 0;
}

export function sha512Sync(input: Uint8Array): Uint8Array {
  const len = input.length;
  const bitLen = len * 8;
  const paddedLen = Math.ceil((len + 17) / 128) * 128;
  const padded = new Uint8Array(paddedLen);
  padded.set(input);
  padded[len] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  let h0h = 0x6a09e667 | 0;
  let h0l = 0xf3bcc908 | 0;
  let h1h = 0xbb67ae85 | 0;
  let h1l = 0x84caa73b | 0;
  let h2h = 0x3c6ef372 | 0;
  let h2l = 0xfe94f82b | 0;
  let h3h = 0xa54ff53a | 0;
  let h3l = 0x5f1d36f1 | 0;
  let h4h = 0x510e527f | 0;
  let h4l = 0xade682d1 | 0;
  let h5h = 0x9b05688c | 0;
  let h5l = 0x2b3e6c1f | 0;
  let h6h = 0x1f83d9ab | 0;
  let h6l = 0xfb41bd6b | 0;
  let h7h = 0x5be0cd19 | 0;
  let h7l = 0x137e2179 | 0;

  for (let offset = 0; offset < paddedLen; offset += 128) {
    for (let i = 0; i < 16; i++) {
      SHA512_W_HI[i] = view.getInt32(offset + i * 8, false);
      SHA512_W_LO[i] = view.getInt32(offset + i * 8 + 4, false);
    }
    for (let i = 16; i < 80; i++) {
      const w15h = SHA512_W_HI[i - 15]!;
      const w15l = SHA512_W_LO[i - 15]!;
      const s0h =
        ((w15h >>> 1) | (w15l << 31)) ^
        ((w15h >>> 8) | (w15l << 24)) ^
        (w15h >>> 7);
      const s0l =
        ((w15l >>> 1) | (w15h << 31)) ^
        ((w15l >>> 8) | (w15h << 24)) ^
        ((w15l >>> 7) | (w15h << 25));

      const w2h = SHA512_W_HI[i - 2]!;
      const w2l = SHA512_W_LO[i - 2]!;
      const s1h =
        ((w2h >>> 19) | (w2l << 13)) ^
        ((w2l >>> 29) | (w2h << 3)) ^
        (w2h >>> 6);
      const s1l =
        ((w2l >>> 19) | (w2h << 13)) ^
        ((w2h >>> 29) | (w2l << 3)) ^
        ((w2l >>> 6) | (w2h << 26));

      const w16h = SHA512_W_HI[i - 16]!;
      const w16l = SHA512_W_LO[i - 16]!;
      const w7h = SHA512_W_HI[i - 7]!;
      const w7l = SHA512_W_LO[i - 7]!;

      const t1l = add64Lo(w16l, s0l);
      const t1h = (w16h + s0h + add64Carry(w16l, s0l)) | 0;
      const t2l = add64Lo(t1l, w7l);
      const t2h = (t1h + w7h + add64Carry(t1l, w7l)) | 0;
      SHA512_W_LO[i] = add64Lo(t2l, s1l);
      SHA512_W_HI[i] = (t2h + s1h + add64Carry(t2l, s1l)) | 0;
    }

    let ah = h0h;
    let al = h0l;
    let bh = h1h;
    let bl = h1l;
    let ch = h2h;
    let cl = h2l;
    let dh = h3h;
    let dl = h3l;
    let eh = h4h;
    let el = h4l;
    let fh = h5h;
    let fl = h5l;
    let gh = h6h;
    let gl = h6l;
    let hh = h7h;
    let hl = h7l;

    for (let i = 0; i < 80; i++) {
      const S1h =
        ((eh >>> 14) | (el << 18)) ^
        ((eh >>> 18) | (el << 14)) ^
        ((el >>> 9) | (eh << 23));
      const S1l =
        ((el >>> 14) | (eh << 18)) ^
        ((el >>> 18) | (eh << 14)) ^
        ((eh >>> 9) | (el << 23));
      const chH = (eh & fh) ^ (~eh & gh);
      const chL = (el & fl) ^ (~el & gl);

      const kh = SHA512_K_HI[i]!;
      const kl = SHA512_K_LO[i]!;
      const wh = SHA512_W_HI[i]!;
      const wl = SHA512_W_LO[i]!;

      let t1l = add64Lo(hl, S1l);
      let t1h = (hh + S1h + add64Carry(hl, S1l)) | 0;
      let c1 = add64Carry(t1l, chL);
      t1l = add64Lo(t1l, chL);
      t1h = (t1h + chH + c1) | 0;
      c1 = add64Carry(t1l, kl);
      t1l = add64Lo(t1l, kl);
      t1h = (t1h + kh + c1) | 0;
      c1 = add64Carry(t1l, wl);
      t1l = add64Lo(t1l, wl);
      t1h = (t1h + wh + c1) | 0;

      const S0h =
        ((ah >>> 28) | (al << 4)) ^
        ((al >>> 2) | (ah << 30)) ^
        ((al >>> 7) | (ah << 25));
      const S0l =
        ((al >>> 28) | (ah << 4)) ^
        ((ah >>> 2) | (al << 30)) ^
        ((ah >>> 7) | (al << 25));
      const majH = (ah & bh) ^ (ah & ch) ^ (bh & ch);
      const majL = (al & bl) ^ (al & cl) ^ (bl & cl);

      const t2l = add64Lo(S0l, majL);
      const t2h = (S0h + majH + add64Carry(S0l, majL)) | 0;

      hh = gh;
      hl = gl;
      gh = fh;
      gl = fl;
      fh = eh;
      fl = el;
      el = add64Lo(dl, t1l);
      eh = (dh + t1h + add64Carry(dl, t1l)) | 0;
      dh = ch;
      dl = cl;
      ch = bh;
      cl = bl;
      bh = ah;
      bl = al;
      al = add64Lo(t1l, t2l);
      ah = (t1h + t2h + add64Carry(t1l, t2l)) | 0;
    }

    let carry = add64Carry(h0l, al);
    h0l = add64Lo(h0l, al);
    h0h = (h0h + ah + carry) | 0;
    carry = add64Carry(h1l, bl);
    h1l = add64Lo(h1l, bl);
    h1h = (h1h + bh + carry) | 0;
    carry = add64Carry(h2l, cl);
    h2l = add64Lo(h2l, cl);
    h2h = (h2h + ch + carry) | 0;
    carry = add64Carry(h3l, dl);
    h3l = add64Lo(h3l, dl);
    h3h = (h3h + dh + carry) | 0;
    carry = add64Carry(h4l, el);
    h4l = add64Lo(h4l, el);
    h4h = (h4h + eh + carry) | 0;
    carry = add64Carry(h5l, fl);
    h5l = add64Lo(h5l, fl);
    h5h = (h5h + fh + carry) | 0;
    carry = add64Carry(h6l, gl);
    h6l = add64Lo(h6l, gl);
    h6h = (h6h + gh + carry) | 0;
    carry = add64Carry(h7l, hl);
    h7l = add64Lo(h7l, hl);
    h7h = (h7h + hh + carry) | 0;
  }

  const out = new Uint8Array(64);
  const outView = new DataView(out.buffer);
  const pairs: readonly [number, number][] = [
    [h0h, h0l],
    [h1h, h1l],
    [h2h, h2l],
    [h3h, h3l],
    [h4h, h4l],
    [h5h, h5l],
    [h6h, h6l],
    [h7h, h7l],
  ];
  pairs.forEach(([hi, lo], idx) => {
    outView.setInt32(idx * 8, hi, false);
    outView.setInt32(idx * 8 + 4, lo, false);
  });
  return out;
}

export function normalizeHashAlgorithmName(raw: string): SyncHashAlgorithm | null {
  const clean = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean === "SHA1") return "SHA1";
  if (clean === "SHA256") return "SHA256";
  if (clean === "SHA512") return "SHA512";
  return null;
}

export function computeSyncHash(algorithm: SyncHashAlgorithm, data: Uint8Array): Uint8Array {
  if (algorithm === "SHA1") return sha1Sync(data);
  if (algorithm === "SHA256") return sha256Sync(data);
  return sha512Sync(data);
}
