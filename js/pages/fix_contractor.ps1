$path = "js\pages\contractor.js"
if (Test-Path $path) {
    # 雿輻 UTF8 蝺函Ⅳ霈?誑靽?銝剜?摮?
    $content = Get-Content -Path $path -Encoding UTF8
    $newContent = @()
    $skip = $false

    foreach ($line in $content) {
        # 雿輻?桀???銝脖??踹? $ 鋡怎???賂?銝衣移蝣箸?撠璅?
        # ?格?銵摰對?options.push(`<option value="RES_${r.id}">${r.name || '?芰??} - ${r.address}</option>`);
        if ($line -like '*options.push(`<option value="RES_${r.id}">${r.name || *') {
            $skip = $true
            # ?踵??批捆嚗蝙?典撘?銝血??折?撘??? (''?芰??') 靘歲??            $newContent += '            options.push(`<option value="RES_${r.id}">${r.name || ''?芰??'} - ${r.address}</option>`);'
            continue
        }
        
        if ($skip) {
            # ?嗆?啣?憛???
            if ($line -like "*});*") {
                $skip = $false
                $newContent += "        });"
                $newContent += "        predefinedOnly.forEach(a => {"
                $newContent += '            options.push(`<option value="ADDR_${a.id}_${a.blockId}">${a.address} (?身?啣?)</option>`);'
                $newContent += "        });"
                $newContent += "        select.innerHTML = '<option value="""">-- ?寞活憟?喳? --</option>' + options.join('');"
            }
            continue
        }
        
        $newContent += $line
    }

    # 雿輻 UTF8 蝺函Ⅳ撖怠?
    $newContent | Set-Content -Path $path -Encoding UTF8
    Write-Host "Successfully processed $path"
} else {
    Write-Error "Could not find $path"
}
