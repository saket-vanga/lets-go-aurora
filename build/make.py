import zlib, struct, math, random, sys, os
root = sys.argv[1]
def png(path, S):
    random.seed(4)
    stars = [(random.random()*S, random.random()*S*0.6, random.random()*1.2+0.4) for _ in range(28)]
    rows = []
    for y in range(S):
        row = bytearray([0])
        for x in range(S):
            u, v = x/S, y/S
            r, g, b = 6+10*v, 10+14*v, 22+30*v
            # aurora ribbon
            c = 0.42 + 0.10*math.sin(u*2.4*math.pi+0.6) + 0.03*math.sin(u*19)
            d = (c - v)
            if 0 < d < 0.34:
                t = d/0.34
                inten = (1-t)**1.6 * (0.55+0.45*math.sin(u*9+1.3)**2)
                gr = (111*(1-t)+182*t, 245*(1-t)+156*t, 196*(1-t)+255*t)
                r += gr[0]*inten; g += gr[1]*inten; b += gr[2]*inten
            elif -0.03 < d <= 0:
                k = (d+0.03)/0.03*0.9
                r += 111*k; g += 245*k; b += 196*k
            for sx, sy, sr in stars:
                dd = (x-sx)**2+(y-sy)**2
                if dd < (sr*S/180)**2*4:
                    r = g = b = 230
            # mountains
            m = 0.80 - 0.10*abs(((u*3.2) % 2)-1) - 0.04*math.sin(u*13)
            if v > m:
                r, g, b = 236, 242, 255
                if v > m+0.035: r, g, b = 200, 214, 240
            row += bytes([min(255,int(r)), min(255,int(g)), min(255,int(b))])
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(t, d): return struct.pack('>I', len(d))+t+d+struct.pack('>I', zlib.crc32(t+d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR', struct.pack('>IIBBBBB', S, S, 8, 2, 0, 0, 0))+chunk(b'IDAT', zlib.compress(raw, 9))+chunk(b'IEND', b'')
    open(path, 'wb').write(data)
png(os.path.join(root, 'icon-180.png'), 180)
png(os.path.join(root, 'icon-512.png'), 512)
