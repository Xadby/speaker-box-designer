/**
 * Функции экспорта проектов и чертежей
 */

class ExportManager {
    /**
     * Экспортировать проект как JSON
     */
    static exportJSON() {
        const data = calculator.getParameters();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `speaker-box-${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Импортировать проект из JSON
     */
    static importJSON(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                calculator.setParameters(data);
                updateAllUI();
                console.log('Проект загружен успешно');
            } catch (error) {
                alert('Ошибка при загрузке файла: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    /**
     * Экспортировать чертеж как PDF
     */
    static exportPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('portrait', 'mm', 'a4');
        
        const params = calculator.getParameters();
        const dim = params.dimensions;
        const vol = params.volume;
        
        // Заголовок
        doc.setFontSize(16);
        doc.text('Speaker Box Blueprint', 20, 20);
        
        // Размеры
        doc.setFontSize(12);
        let yPos = 40;
        doc.text(`External Dimensions:`, 20, yPos);
        yPos += 10;
        doc.setFontSize(10);
        doc.text(`Width: ${dim.width} mm`, 25, yPos);
        yPos += 8;
        doc.text(`Height: ${dim.height} mm`, 25, yPos);
        yPos += 8;
        doc.text(`Depth: ${dim.depth} mm`, 25, yPos);
        yPos += 8;
        doc.text(`Material Thickness: ${dim.thickness} mm`, 25, yPos);
        
        // Объем
        yPos += 15;
        doc.setFontSize(12);
        doc.text('Volume:', 20, yPos);
        yPos += 10;
        doc.setFontSize(10);
        doc.text(`${vol.liters} Liters (${vol.cm3} cm³)`, 25, yPos);
        
        // Порты
        if (params.port.enabled) {
            yPos += 15;
            doc.setFontSize(12);
            doc.text('Ported Configuration:', 20, yPos);
            yPos += 10;
            doc.setFontSize(10);
            doc.text(`Port Diameter: ${params.port.diameter} mm`, 25, yPos);
            yPos += 8;
            doc.text(`Port Length: ${params.port.length} mm`, 25, yPos);
            yPos += 8;
            doc.text(`Tuning Frequency: ${params.port.frequency} Hz`, 25, yPos);
        }
        
        // Добавить скриншот 3D модели
        yPos += 20;
        const screenshot = threeSetup.getScreenshot();
        doc.addImage(screenshot, 'PNG', 20, yPos, 170, 120);
        
        // Сохранить PDF
        doc.save(`speaker-box-blueprint-${new Date().getTime()}.pdf`);
    }

    /**
     * Экспортировать как DXF (упрощенный формат)
     */
    static exportDXF() {
        const params = calculator.getParameters();
        const dim = params.dimensions;
        
        let dxf = `0\nSECTION\n8\nHEADER\n0\nENDSEC\n0\nSECTION\n8\nENTITIES\n`;
        
        // Внешний прямоугольник
        dxf += `0\nLWPOLYLINE\n8\nBOX\n10\n0\n20\n0\n10\n${dim.width}\n20\n0\n10\n${dim.width}\n20\n${dim.height}\n10\n0\n20\n${dim.height}\n10\n0\n20\n0\n`;
        
        // Размеры
        dxf += `0\nTEXT\n8\nDIMENSIONS\n10\n${dim.width / 2}\n20\n-20\n40\n10\n1\nWidth: ${dim.width}mm\n`;
        dxf += `0\nTEXT\n8\nDIMENSIONS\n10\n-30\n20\n${dim.height / 2}\n40\n10\n1\nHeight: ${dim.height}mm\n`;
        
        dxf += `0\nENDSEC\n0\nEOF\n`;
        
        const blob = new Blob([dxf], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `speaker-box-${new Date().getTime()}.dxf`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Экспортировать как STL (упрощенный формат)
     */
    static exportSTL() {
        const params = calculator.getParameters();
        const dim = params.dimensions;
        
        // Создать простейшую STL геометрию
        const vertices = [
            // Front face
            0, 0, 0, dim.width, 0, 0, dim.width, dim.height, 0,
            0, dim.height, 0,
            // Back face
            0, 0, dim.depth, dim.width, 0, dim.depth, dim.width, dim.height, dim.depth,
            0, dim.height, dim.depth
        ];
        
        let stl = 'solid Speaker_Box\n';
        
        // Создать простые треугольники
        const faces = [
            [0, 1, 2], [0, 2, 3], // front
            [4, 6, 5], [4, 7, 6], // back
        ];
        
        faces.forEach(face => {
            stl += 'facet normal 0 0 0\n';
            stl += ' outer loop\n';
            stl += `  vertex ${vertices[face[0]*3]} ${vertices[face[0]*3+1]} ${vertices[face[0]*3+2]}\n`;
            stl += `  vertex ${vertices[face[1]*3]} ${vertices[face[1]*3+1]} ${vertices[face[1]*3+2]}\n`;
            stl += `  vertex ${vertices[face[2]*3]} ${vertices[face[2]*3+1]} ${vertices[face[2]*3+2]}\n`;
            stl += ' endloop\n';
            stl += 'endfacet\n';
        });
        
        stl += 'endsolid Speaker_Box\n';
        
        const blob = new Blob([stl], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `speaker-box-${new Date().getTime()}.stl`;
        a.click();
        URL.revokeObjectURL(url);
    }
}
