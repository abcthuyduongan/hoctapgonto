import sys
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

doc = Document()
section = doc.sections[0]
section.top_margin = section.bottom_margin = Inches(.65)
section.left_margin = section.right_margin = Inches(.7)
section.page_width, section.page_height = Inches(8.27), Inches(11.69)
for name in ['Normal', 'Title', 'Heading 1', 'Heading 2']:
    style = doc.styles[name]
    style.font.name = 'Arial'
    style.font.color.rgb = RGBColor(0, 0, 0)
    style.font.size = Pt(11 if name == 'Normal' else 22 if name == 'Title' else 15)
    style.paragraph_format.space_after = Pt(6)
    for borders in list(style.element.iter(qn('w:pBdr'))):
        borders.getparent().remove(borders)
doc.styles['Normal'].paragraph_format.line_spacing = 1.05

def table(rows, header=True):
    tbl = doc.add_table(rows=0, cols=2)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    tbl.columns[0].width, tbl.columns[1].width = Inches(1.8), Inches(5.07)
    for index, values in enumerate(rows):
        cells = tbl.add_row().cells
        for column, value in enumerate(values):
            cells[column].text = value
            cells[column].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tcpr = cells[column]._tc.get_or_add_tcPr()
            border = OxmlElement('w:tcBorders')
            for edge in ['top', 'left', 'bottom', 'right']:
                part = OxmlElement('w:' + edge); part.set(qn('w:val'), 'single'); part.set(qn('w:sz'), '4'); part.set(qn('w:color'), 'D9D9D9'); border.append(part)
            tcpr.append(border)
            margins = OxmlElement('w:tcMar')
            for side in ['top', 'left', 'bottom', 'right']:
                item = OxmlElement('w:' + side); item.set(qn('w:w'), '70'); item.set(qn('w:type'), 'dxa'); margins.append(item)
            tcpr.append(margins)
            for paragraph in cells[column].paragraphs:
                paragraph.paragraph_format.space_after = Pt(2)
                paragraph.paragraph_format.space_before = Pt(2)
                for run in paragraph.runs:
                    run.font.name = 'Arial'; run.font.size = Pt(10)
                    if index == 0 and header:
                        run.bold = True; run.font.color.rgb = RGBColor(255,255,255)
            if index == 0 and header:
                shade = OxmlElement('w:shd'); shade.set(qn('w:fill'),'233C61'); tcpr.append(shade)
            elif index % 2:
                shade = OxmlElement('w:shd'); shade.set(qn('w:fill'),'F1F4F8'); tcpr.append(shade)
        trpr = tbl.rows[-1]._tr.get_or_add_trPr()
        keep = OxmlElement('w:cantSplit'); trpr.append(keep)
        if index == 0 and header:
            repeat = OxmlElement('w:tblHeader'); trpr.append(repeat)
    doc.add_paragraph().paragraph_format.space_after = Pt(3)
    return tbl

doc.add_paragraph('Mẫu soạn học liệu theo tuần', 'Title')
doc.add_paragraph('Người soạn điền nội dung và đáp án vào các bảng bên dưới. Mỗi môn và dạng câu cần ít nhất 2 câu và tối đa 30 câu. Sao chép nguyên bảng để thêm câu mới. Bảng chưa có nội dung câu hỏi được bỏ qua khi nhập.')
table([['schema','baoan-online-week'], ['formatVersion','1'], ['title','']], False)
doc.add_paragraph('Cách điền mẫu', 'Heading 1')
doc.add_paragraph('Giữ nguyên tên trường ở cột field và nhập nội dung ở cột value. subjectLabel là tên môn tự đặt. topic, competition và level là nhãn tự chọn. title là tên bộ câu hỏi. Tên tuần được điền trong bảng thông tin ở trên hoặc trường week của câu hỏi.')
doc.add_paragraph('Để dùng hình ảnh hoặc âm thanh, tải tệp riêng trong ứng dụng rồi ghi đúng tên tệp vào imageFile hoặc audioFile. Hình ảnh cần imageAlt. Âm thanh cần audioTranscript. Không nhúng tệp vào Word. source và rights ghi nguồn cùng quyền sử dụng của nội dung.')
doc.add_paragraph('allowedGameIds giới hạn trò cho từng câu, có thể để trống. Dùng mã math-quest, memory-match, sentence-builder, word-connect, sequence-trail và tách bằng dấu |. Ví dụ memory-match|word-connect. Bộ chỉ mở trò chung cho tất cả câu và vẫn kiểm tra cấu trúc dữ liệu.')
doc.add_paragraph('Các dạng câu hỗ trợ', 'Heading 1')
descriptions = [
 ('quiz','Trắc nghiệm có bốn lựa chọn và một đáp án A–D'),
 ('pairs','Ghép cặp hai nội dung left và right'),
 ('sentences','Sắp xếp câu hoặc thứ tự do tác giả chỉ định'),
 ('numeric-answer','Nhập đáp án số nguyên hoặc thập phân'),
 ('fill-blank','Điền từ với một hoặc nhiều đáp án chấp nhận'),
 ('reading-choice','Đọc đoạn văn rồi chọn một trong bốn đáp án'),
 ('listening-choice','Nghe âm thanh rồi chọn một trong bốn đáp án'),
 ('listening-gap','Nghe âm thanh rồi điền đáp án'),
]
table([['Mã dạng câu','Nội dung'], *descriptions])
doc.add_paragraph('Mẫu này phục vụ nội dung luyện tập do người soạn cung cấp. Nhãn cuộc thi không xác nhận đây là đề chính thức hay đã theo một cấu trúc kỳ thi cụ thể.')

common = ['subjectLabel','title','topic','week','competition','level','allowedGameIds']
media = ['imageFile','imageAlt','audioFile','audioTranscript','source','rights']
definitions = [
 ('quiz','Trắc nghiệm','Điền prompt, bốn phương án A B C D khác nhau và answer là A, B, C hoặc D.', ['prompt','A','B','C','D','answer','explanation']),
 ('pairs','Ghép cặp','Điền left và right. Không lặp các mặt thẻ trong cùng bộ. Mỗi bảng là một cặp.', ['left','right']),
 ('sentences','Sắp xếp','Điền prompt và answer là câu đúng 3–15 từ. Có thể dùng words, tách mỗi từ bằng dấu |. Chỉ cần điền một cách biểu diễn đáp án.', ['prompt','answer','words','hint']),
 ('numeric-answer','Nhập đáp án số','Điền prompt và answer là số nguyên hoặc số thập phân. unit là đơn vị tùy chọn.', ['prompt','answer','unit','hint','explanation']),
 ('fill-blank','Điền từ','Điền prompt và acceptedAnswers. Dùng dấu | giữa các đáp án chấp nhận. caseSensitive là true hoặc false, bỏ trống tương đương false.', ['prompt','acceptedAnswers','caseSensitive','hint','explanation']),
 ('reading-choice','Đọc và chọn','Điền passage cùng nguồn, prompt, bốn phương án và answer là A, B, C hoặc D. Có thể dùng cùng đoạn đọc cho nhiều câu.', ['passageTitle','passage','prompt','A','B','C','D','answer','hint','explanation']),
 ('listening-choice','Nghe và chọn','Bắt buộc audioFile và audioTranscript. Điền prompt, bốn phương án và answer là A, B, C hoặc D.', ['prompt','A','B','C','D','answer','hint','explanation']),
 ('listening-gap','Nghe và điền','Bắt buộc audioFile và audioTranscript. Điền prompt cùng acceptedAnswers, tách đáp án bằng dấu |.', ['prompt','acceptedAnswers','caseSensitive','hint','explanation']),
]
for kind, heading, instructions, fields in definitions:
    doc.add_page_break()
    doc.add_paragraph(heading, 'Heading 1')
    doc.add_paragraph(instructions)
    doc.add_paragraph('Sao chép bảng này để thêm câu cùng dạng. Điền tối thiểu hai câu trong cùng môn và dạng trước khi nhập.')
    rows = [['field','value'], ['kind',kind]] + [[field,''] for field in common + fields + media]
    table(rows)
Path(sys.argv[1]).parent.mkdir(parents=True, exist_ok=True)
doc.save(sys.argv[1])
print('Created Word authoring template')
