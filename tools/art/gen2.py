# usage: gen2.py out.png aspect prompt img1 [img2 ...]
import json,base64,sys,urllib.request,os,mimetypes,time
out,aspect,prompt=sys.argv[1],sys.argv[2],sys.argv[3]
parts=[]
for f in sys.argv[4:]:
    parts.append({"inline_data":{"mime_type":mimetypes.guess_type(f)[0] or "image/png","data":base64.b64encode(open(f,'rb').read()).decode()}})
parts.append({"text":prompt})
body={"contents":[{"parts":parts}],"generationConfig":{"responseModalities":["IMAGE","TEXT"],"imageConfig":{"aspectRatio":aspect,"imageSize":"2K"}}}
model=os.environ.get('M','gemini-3-pro-image')
for attempt in range(3):
    try:
        req=urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",data=json.dumps(body).encode(),headers={"Content-Type":"application/json"})
        d=json.load(urllib.request.urlopen(req,timeout=400))
        for p in d["candidates"][0]["content"]["parts"]:
            if "inlineData" in p:
                open(out,"wb").write(base64.b64decode(p["inlineData"]["data"])); print("ok",out); sys.exit(0)
        print("noimg",out,json.dumps(d)[:300])
    except Exception as e: print("err",out,str(e)[:300])
    time.sleep(3)
sys.exit(1)
